/* jshint esversion: 6 */

var Promise = require('promise'),
    db = require('../db/adapter/redis'),
    flat = require('flat'),
    doBackgroundFech = true;

function globalReject(name, error, reject, callback) {
    if (error) {
        console.log(name, error.name, error.statusCode);
    } else {
        console.log(name);
    }

    if (callback) {
        callback(error);
    }

    if (reject) {
        reject(error);
    }
}

function globalResolve(name, data, resolve, callback) {
    // console.log(name, !!data, !!resolve, !!callback);

    if (callback) {
        callback(undefined, data);
    }

    if (resolve) {
        resolve(data);
    }
}

function formatData(data) {
    if (data) {
        Object.keys(data).forEach(function(key) {
            var numVal = parseFloat(data[key], 10);

            if (numVal == data[key]) {
                data[key] = numVal;
            }
        });
    }

    return data;
}

var cache = {
    /** Gets key from cache if exists, else sets the cache and returns data.
     * @param {string} cacheKey - Key to get or set.
     * @param {integer} timeout - Timeout (in seconds) for cache to release.
     * @param {Function} fn - Function to get data if key does not exist.
     * @param {boolean} isLookup - First check as a generic key value and use that value for a final lookup and/or set.
     * @param {Function} callback - Callback function to send back data or value.
     */
    getOrSet: function(cacheKeyPrefix, cacheKey, timeout, fn, newCheck, isLookup, queueKey, callback) {
        var client = db.getClient();

        return new Promise(function(resolve, reject) {
            if (isLookup) {
                /**
                 * isLookup tells us that the cacheKey is just the first part and that we need to retrieve
                 * the most recent id from a lookup.
                 */
                client.getAsync(`${cacheKeyPrefix}:${cacheKey}`).then(function(timestamps) {
                    var time = Date.now(),
                        id,
                        oldCacheKey,
                        timestamp;

                    /**
                     * Timestamps are delimited by a | where the first timestamp is the ID and every
                     * subsequent ones are actually the last checked time for new data.
                     *
                     * The last checked time defaults to the first timestamp if there are no other ones.
                     *
                     * Timestamp gets set to '1' in the case of refreshing the data. 
                     * While 1, additional requests to get data only returns the old data and does not start a new update request.
                     */
                    timestamps = timestamps ? timestamps.split('|') : timestamps;
                    timestamp = timestamps ? parseInt(timestamps[timestamps.length - 1], 10) : timestamps;
                    id = timestamps ? parseInt(timestamps[0]) : timestamp;
                    oldCacheKey = `${cacheKeyPrefix}:${cacheKey}:${id}`;
                    console.log('getOrSet', oldCacheKey, id, timestamp, timeout, time, timestamp + timeout > time);

                    if (timestamp && (timestamp === 1 || timestamp + timeout > time) && !!queueKey) {
                        /**
                         * If timestamp is not expired or timestamp is currently being refreshed,
                         * return the current data.
                         */
                        cache.get(oldCacheKey).then(function(result) {
                            if (result) {
                                result = flat.unflatten(result);
                                globalResolve('resolve', result, resolve, callback);
                            } else {
                                setAndReturn();
                            }
                        });
                    } else {
                        if (id) {
                            /**
                             * If timestamp is expired, update timestamp to show refreshing '1'
                             * and start fetching the new data to compare with.
                             */
                            cache.get(oldCacheKey).then(function(result) {
                                if (result) {
                                    result = flat.unflatten(result);
                                }

                                if (doBackgroundFech && queueKey) {
                                    client.saddAsync(queueKey, cacheKey).then(function(queueResult) {
                                        globalResolve('resolve', result, resolve, callback);
                                    }, function(error) {
                                        globalReject('isRefreshing set error', error, reject, callback);
                                    });
                                } else {
                                    /**
                                     * Fetch new data and is !!result then do a comparison against old data
                                     */
                                    setAndReturn(id, result);
                                }
                            });
                        } else if (doBackgroundFech && queueKey) {
                            console.log(`Adding ${cacheKey} to ${queueKey}`);
                            client.saddAsync(queueKey, cacheKey).then(function(queueResult) {
                                globalResolve('resolve', undefined, resolve, callback);
                            }, function(error) {
                                globalReject('isRefreshing set error', error, reject, callback);
                            });
                        } else {
                            /**
                             * Data doesn't exist even though cacheKey does. 
                             * Go ahead and do a sync load of the new data.
                             */
                            setAndReturn();
                        }
                    }
                }, function(error) {
                    globalReject('getOrSet get', error, reject, callback);
                });
            } else {
                /**
                 * cacheKey is complete and should return data not an ID.
                 */
                cache.get(cacheKey).then(function(result) {
                    if (result) {
                        globalResolve('resolve', flat.unflatten(result), resolve, callback);
                    } else {
                        setAndReturn();
                    }
                }, function(error) {
                    globalReject('getOrSet', error, reject, callback);
                });
            }

            function setAndReturn(oldTimestamp, oldData) {
                var innerResolve = resolve,
                    innerReject = reject,
                    innerCallback = callback;

                /**
                 * fn is what gets passed into the cache manager and is actually what loads and returns data.
                 */
                fn(function(fnErr, data) {
                    /**
                     * Determine if the data returned is unique or duplicate to old data
                     */
                    var isNew = !oldData || newCheck(oldData, data);

                    if (fnErr) {
                        globalReject('setFn', fnErr, innerReject, innerCallback);
                        return;
                    }

                    /**
                     * This does 1 of 2 things:
                     * 1) If new data it adds the data to the cache and then returns it
                     * 2) If data is not new it updates the lastChecked timestamp of the old data and updates the cacheKey with the lastChecked timestamp.
                     */
                    cache.set(`${cacheKeyPrefix}:${cacheKey}:${isNew ? data.timestamp : oldTimestamp}`, undefined, function(dataCallback) {
                        if (isNew) {
                            // If data is new then return the data with lastChecked being set to the timestamp
                            data.lastChecked = data.timestamp;
                            dataCallback(undefined, flat.flatten(data));
                        } else {
                            // If data is duplicated by old data, just update the lastChecked to the timestamp
                            dataCallback(undefined, 'lastChecked', data.timestamp);
                        }
                    }).then(function(result) {
                        if (isLookup) {
                            /**
                             * If using a lookup table, the timestamp of the last check needs to be inserted
                             * so that we know if our data needs to be rechecked in the future.
                             */
                            cache.set(`${cacheKeyPrefix}:${cacheKey}`, undefined, function(dataCallback) {
                                // Build the lookup table value which is ID|LAST_CHECKED
                                dataCallback(null, isNew ? data.timestamp : [oldTimestamp, data.timestamp].join('|'));
                            }).then(function(result) {
                                globalResolve('resolve', data, innerResolve, innerCallback);
                            }, function(error) {
                                globalReject('setAndReturn set', error, innerReject, innerCallback);
                            });
                        } else {
                            // If not lookup table then just return the item
                            globalResolve('resolve', data, innerResolve, innerCallback);
                        }
                    }, function(error) {
                        globalReject('setAndReturn', error, innerReject, innerCallback);
                    });
                });
            }
        });

    },

    get: function(cacheKey, type, callback) {
        var client = db.getClient();

        return new Promise(function(resolve, reject) {
            client.hgetallAsync(cacheKey).then(function(data) {
                formatData(data);
                globalResolve('resolve', data, resolve, callback);
            }, function(error) {
                globalReject('get', error, reject, callback);
            });
        });
    },

    set: function(cacheKey, timeout, fn, callback) {
        var client = db.getClient();

        return new Promise(function(resolve, reject) {
            fn(function(fnErr, property, value) {
                var args = [cacheKey, property, value],
                    method = 'setAsync';

                if (fnErr) {
                    globalReject('setFn', fnErr, reject, callback);
                    return;
                }

                if (value === undefined) {
                    args.pop();
                }

                if (typeof property === 'object') {
                    method = 'hmsetAsync';
                } else if (typeof property === 'string' && value !== undefined) {
                    method = 'hsetAsync';
                }

                console.log('set',
                    cacheKey,
                    method,
                    typeof property === 'object' ? 'Object' : property,
                    typeof value === 'object' ? 'Object' : value
                );

                client[method].apply(client, args).then(function(data) {
                    globalResolve('resolve', data, resolve, callback);
                }, function(error) {
                    globalReject('set', error, reject, callback);
                });
            });
        });
    }
};

module.exports = cache;

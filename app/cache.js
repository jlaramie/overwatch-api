var NodeCache = require('node-cache'),
    myCache = new NodeCache(),
    Promise = require('promise'),
    db = require('./db/adapter/redis.js'),
    flat = require('flat');

function globalReject(name, error, reject, callback) {
    console.log(name, error);

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
    Object.keys(data).forEach(function(key) {
        var numVal = parseFloat(data[key], 10);

        if (numVal == data[key]) {
            data[key] = numVal;
        }
    });
}

var cache = {
    /** Gets key from cache if exists, else sets the cache and returns data.
     * @param {string} cacheKey - Key to get or set.
     * @param {integer} timeout - Timeout (in seconds) for cache to release.
     * @param {Function} fn - Function to get data if key does not exist.
     * @param {boolean} isLookup - First check as a generic key value and use that value for a final lookup and/or set.
     * @param {Function} callback - Callback function to send back data or value.
     */
    getOrSet: function(cacheKey, timeout, fn, isLookup, callback) {
        var client = db.getClient();

        return new Promise(function(resolve, reject) {
            if (isLookup) {
                client.getAsync(cacheKey).then(function(timestamp) {
                    var time = Date.now();

                    timestamp = timestamp ? parseInt(timestamp, 10) : timestamp;
                    console.log('getOrSet', cacheKey, timestamp, timeout, time, timestamp + timeout > time);
                    if (timestamp && timestamp + timeout > time) {
                        cache.get(`${cacheKey}:${timestamp}`).then(function(result) {
                            if (result) {
                                globalResolve('resolve', flat.unflatten(result), resolve, callback);
                            } else {
                                setAndReturn();
                            }
                        });
                    } else {
                        setAndReturn();
                    }
                }, function(error) {
                    globalReject('getOrSet get', error, reject, callback);
                });
            } else {
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

            function setAndReturn() {
                fn(function(error, data, id) {
                    cache.set(`${cacheKey}${id ? ':' + id : ''}`, timeout, function(dataCallback) {
                        dataCallback(undefined, flat.flatten(data));
                    }).then(function(result) {
                        if (result) {
                            cache.set(`${cacheKey}`, timeout, function(dataCallback) {
                                dataCallback(null, id);
                            }).then(function(result) {
                                globalResolve('resolve', data, resolve, callback);
                            }, function(error) {
                                globalReject('setAndReturn set', error, reject, callback);
                            });
                        } else {
                            globalResolve('resolve', data, resolve, callback);
                        }
                    }, function(error) {
                        globalReject('setAndReturn', error, reject, callback);
                    })
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
            fn(function(fnErr, data) {
                if (fnErr) {
                    globalReject('setFn', fnErr, reject, callback);
                    return;
                }

                client[typeof data === 'object' ? 'hmsetAsync' : 'setAsync'](cacheKey, data).then(function(data) {
                    globalResolve('resolve', data, resolve, callback);
                }, function(error) {
                    globalReject('set', error, reject, callback);
                });
            });
        });
    },


}

module.exports = cache;

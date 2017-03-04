/* jshint esversion: 6 */

var db = require('../db/adapter/dynamodb'),
    redisDb = require('../db/adapter/redis'),
    doBackgroundFech = true;

function globalReject(name, error, reject, callback) {
    if (error) {
        console.log(name, error.name, error.statusCode, error.error, error.message);
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

var cache = {
    /** Gets key from cache if exists, else sets the cache and returns data.
     * @param {string} table - Table to do loockup
     * @param {string} primary - Primary ID to lookup
     * @param {string} secondary - Secondary ID to lookup
     * @param {integer} timeout - Timeout (in seconds) for cache to release.
     * @param {Function} fn - Function to get data if key does not exist.
     * @param {Function} callback - Callback function to send back data or value.
     */
    getOrSet: function(table, primary, secondary, timeout, fn, newCheck, queueKey, callback) {
        var documentClient = db.getClient(),
            client = redisDb.getClient(),
            cacheKey = primary ? primary[1] : undefined,
            keys = {};

        if (primary) {
            keys[primary[0]] = primary[1];
        }

        if (secondary) {
            keys[secondary[0]] = secondary[1];
        }

        return new Promise(function(resolve, reject) {
            cache.get(table, keys).then(function(result) {
                var timestamp,
                    time = Date.now();

                result = result.Items[0];
                timestamp = result ? result.lastChecked || result.timestamp : undefined;

                if (result && timestamp + timeout > time) {
                    // Result checks out
                    globalResolve('resolve', result, resolve, callback);
                } else if (doBackgroundFech && queueKey) {
                    // Queue enabled. Added to queue and return result if one exists already
                    console.log(`Adding ${cacheKey} to ${queueKey}`);
                    client.saddAsync(queueKey, cacheKey).then(function(queueResult) {
                        globalResolve('resolve', result, resolve, callback);
                    }, function(error) {
                        globalReject('isRefreshing set error', error, reject, callback);
                    });
                } else {
                    // Queue is disabled. Fetch new result and compare against old result if provided.
                    setAndReturn(timestamp, result);
                }
            });

            function setAndReturn(oldTimestamp, oldData) {
                var innerResolve = resolve,
                    innerReject = reject,
                    innerCallback = callback,
                    promises = [];

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
                     * Adds the username to our table of usernames for easier lookups of who we are tracking
                     */
                    if (!oldData) {
                        console.log('updating usernames', data.username);
                        promises.push(cache.set('Overwatch_Profiles_Usernames', {
                            username: data.username
                        }));
                    }

                    /**
                     * This does 1 of 2 things:
                     * 1) If new data it adds the data to the cache and then returns it
                     * 2) If data is not new it updates the lastChecked timestamp of the old data and updates the cacheKey with the lastChecked timestamp.
                     */
                    if (isNew) {
                        console.log('adding entry');
                        data.lastChecked = data.timestamp;
                        promises.push(cache.set(table, data));
                    } else {
                        console.log('updating entry', primary);
                        oldData.lastChecked = data.timestamp;
                        promises.push(cache.update(table, primary, ['timestamp', oldData.timestamp], {
                            lastChecked: data.timestamp
                        }));
                    }

                    Promise.all(promises).then(function() {
                        globalResolve(isNew ? 'adding entry' : 'updating entry', isNew ? data : oldData, innerResolve, innerCallback);
                    }, function(error) {
                        globalReject('update profile', error, innerReject, innerCallback);
                    });
                });
            }
        });

    },

    get: function(table, keys, callback) {
        var documentClient = db.getClient(),
            query = {
                TableName: table,
                KeyConditionExpression: [],
                ExpressionAttributeValues: {},
                Limit: 1,
                ScanIndexForward: false
            };

        Object.keys(keys).forEach(function(key) {
            query.KeyConditionExpression.push(`${key} = :${key}`);
            query.ExpressionAttributeValues[`:${key}`] = `${keys[key]}`;
        });
        query.KeyConditionExpression = query.KeyConditionExpression.join(' AND ');

        return documentClient.query(query).promise();
    },

    update: function(table, primary, secondary, data) {
        var documentClient = db.getClient(),
            query = {
                TableName: table,
                Key: {},
                AttributeUpdates: {}
            };

        if (primary) {
            query.Key[primary[0]] = primary[1];
        }

        if (secondary) {
            query.Key[secondary[0]] = secondary[1];
        }

        Object.keys(data).forEach(function(key) {
            query.AttributeUpdates[key] = {
                Action: 'PUT',
                Value: data[key]
            };
        });

        return documentClient.update(query).promise();
    },

    set: function(table, data, callback) {
        var documentClient = db.getClient();

        return documentClient.put({
            TableName: table,
            Item: data
        }).promise();
    }
};

module.exports = cache;

var NodeCache = require('node-cache'),
    myCache = new NodeCache();

var cache = {
    /** Gets key from cache if exists, else sets the cache and returns data.
     * @param {string} cacheKey - Key to get or set.
     * @param {integer} timeout - Timeout (in seconds) for cache to release.
     * @param {Function} fn - Function to get data if key does not exist.
     * @param {Function} callback - Callback function to send back data or value.
     */
    getOrSet: function(cacheKey, timeout, fn, callback) {
        myCache.get(cacheKey, function(err, value) {
            if (!err) {
                if (value == undefined) {
                    cache.set(cacheKey, timeout, fn, callback);
                } else {
                    callback(null, value);
                }
            } else {
                callback(err);
            }
        });
    },

    get: function(cacheKey, callback) {
        myCache.get(cacheKey, function(err, value) {
            callback(err, value);
        });
    },

    set: function(cacheKey, timeout, fn, callback) {
        fn(function(fnErr, data) {
            if (!fnErr) {
                myCache.set(cacheKey, data, timeout, function(err, success) {
                    callback(err, data);
                });
            } else {
                callback(fnErr);
            }
        });
    }
}

module.exports = cache;

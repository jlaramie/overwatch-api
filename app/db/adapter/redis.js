var redis = require('redis'),
    bluebird = require('bluebird'),
    Promise = require('promise'),
    _ = require('underscore'),
    Config,
    client;

bluebird.promisifyAll(redis.RedisClient.prototype);
bluebird.promisifyAll(redis.Multi.prototype);

function init(config) {
    Config = config;

    return new Promise(function(resolve, reject) {
        if (client) {
            resolve(client);
            return;
        }

        client = redis.createClient(config.redis_url);

        client.on('error', function(err) {
            console.log('Redis Error', err);
            reject(client);
        });

        client.once('connect', function() {
            console.log('Redis Connected');
            resolve(client);
        });
    });
}

module.exports = {
    init: init,
    getClient: function() {
        return client;
    }
};

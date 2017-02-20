'use strict';

var startTime = Date.now(),
    db = require('../app/db/adapter/redis'),
    _ = require('underscore'),
    flat = require('flat');

var AWS = require('aws-sdk'),
    documentClient = new AWS.DynamoDB.DocumentClient();

db.init({
    redis_url: process.env.REDIS_URL
}).then(onInit);

function onInit(client) {
    client.scanAsync(0, 'match', 'Stats:Profiles:*:*:*:*', 'count', 10000).then(function(results) {
        processQueue(client, results[1]).then(function(results) {
            end(results);
        }, onError);

    }, onError);
}

function processQueue(client, list) {
    var results;

    return new Promise(function(resolve, reject) {
        var key,
            newUsername,
            keyTimestamp;

        if (list.length > 0) {
            key = list.pop();
            newUsername = key.replace('Stats:Profiles:', '');
            keyTimestamp = key.replace('Stats:Profiles:' + newUsername, '');
            console.log('Processing: ', key);

            client.hgetallAsync(key).then(function(data) {
                data = flat.unflatten(formatData(data));
                newUsername = newUsername.replace(':' + data.timestamp, '');
                data.username = newUsername;

                console.log('Got data: ', key, 'and putting it in ', newUsername, data.timestamp);

                documentClient.put({
                    TableName: 'Overwatch_Profiles',
                    Item: data,
                    Expected: {
                        timestamp: {
                            ComparisonOperator: "NE",
                            Value: data.timestamp
                        }
                    }
                }).promise().then(function(result) {
                    console.log('Migrated', newUsername, data.timestamp);
                    results = [result];

                    processQueue(client, list).then(function(result) {
                        if (result) {
                            results = results.concat(result);
                        }
                        resolve(result);
                    }, reject);
                }, function(e) {
                    if (e.name === 'ConditionalCheckFailedException') {
                        console.log('Duplicate Found', newUsername, data.timestamp);
                        results = [
                            ['DUPLICATE', newUsername, data.timestamp]
                        ];

                        processQueue(client, list).then(function(result) {
                            if (result) {
                                results = results.concat(result);
                            }
                            resolve(result);
                        }, reject);
                    } else {
                        reject(e);
                    }
                });
            }, reject);
        } else {
            resolve(results);
        }
    });
}

function formatData(data) {
    if (data) {
        Object.keys(data).forEach(function(key) {
            var numVal = parseFloat(data[key], 10);

            if (numVal == data[key]) {
                data[key] = numVal;
            } else if (data[key] === '') {
                delete data[key];
            }
        });
    }

    return data;
}

function onError(e) {
    console.log(e.stack);
    end();
}

function end() {
    console.log('End');
    process.exit();
}

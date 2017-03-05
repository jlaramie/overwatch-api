#! /app/.heroku/node/bin/node

'use strict';

var startTime = Date.now(),
    db = require('./app/db/adapter/dynamodb'),
    _ = require('underscore');

var documentClient = db.init({
    aws_access_key_id: process.env.AWS_ACCESS_KEY_ID,
    aws_secret_access_key: process.env.AWS_SECRET_ACCESS_KEY,
    aws_region: process.env.AWS_REGION,
    aws_url: undefined,
})

var usernames = {},
    resultItems = [];

scanForProfiles().then(function(items) {
    try {
        items.forEach(function(item) {
            console.log(item);
            if (!usernames[item.username] || usernames[item.username] > item.timestamp) {
                usernames[item.username] = item.timestamp;
            }
        });

        batchWriteUsers(Object.keys(usernames)).then(end, onError);
    } catch (e) {
        onError(e);
    }
}, onError);

function scanForProfiles(lastEvaluatedKey) {
    return new Promise(function(resolve, reject) {
        console.log('fetching', lastEvaluatedKey);
        documentClient.scan({
            TableName: 'Overwatch_Profiles',
            Limit: 20000,
            AttributesToGet: ['username', 'timestamp'],
            ExclusiveStartKey: lastEvaluatedKey
        }).promise().then(function(result) {
            resultItems = resultItems.concat(result.Items);

            if (result.Items.length > 0 && result.LastEvaluatedKey) {
                scanForProfiles(result.LastEvaluatedKey).then(function(innerResult) {
                    resultItems = resultItems.concat(innerResult.Items || []);
                    resolve(resultItems);
                }, reject);
            } else {
                resolve(resultItems);
            }
        }, reject);
    });
}

function batchWriteUsers(items) {
    var results = [],
        batch = items.slice(0, 25),
        batchWrite = {
            RequestItems: {
                'Overwatch_Profiles_Usernames': []
            }
        };

    console.log('Found', items.length, ' Processing ', batch.length);

    batch.forEach(function(key) {
        batchWrite.RequestItems.Overwatch_Profiles_Usernames.push({
            PutRequest: {
                Item: {
                    username: key
                }
            }
        });
    });

    if (batchWrite.RequestItems.Overwatch_Profiles_Usernames.length > 0) {
        promises.push(documentClient.batchWrite(batchWrite).promise());
    }

    if (batchWrite.RequestItems.Overwatch_Profiles_Usernames.length > 0) {
        documentClient.batchWrite(batchWrite).promise().then(function(result) {
            results = results.concat(result);

            if (items.length > 25) {
                batchDeleteProfiles(items.slice(25)).then(function(result) {
                    results = results.concat(result);
                    resolve(results)
                });
            } else {
                resolve(results)

            }
        }, reject);
    }
}

function onError(e) {
    console.log(e.stack);
    end();
}

function end() {
    var endTime = Date.now();
    console.log.apply(console, ['End', (endTime - startTime) / 1000].concat(arguments));
    process.exit();
}

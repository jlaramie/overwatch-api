#! /app/.heroku/node/bin/node

'use strict';

var startTime = Date.now(),
    db = require('../app/db/adapter/dynamodb'),
    _ = require('underscore');

var documentClient = db.init({
    aws_access_key_id: process.env.AWS_ACCESS_KEY_ID,
    aws_secret_access_key: process.env.AWS_SECRET_ACCESS_KEY,
    aws_region: process.env.AWS_REGION,
    aws_url: undefined,
});

var resultItems = [],
    batchWrite = {
        RequestItems: {
            'Overwatch_Profiles': []
        }
    };

scanForProfiles().then(function(items) {
    try {
        console.log(JSON.stringify(resultItems));
        batchDeleteProfiles(resultItems).then(end, onError);
    } catch (e) {
        onError(e);
    }
}, onError);


function scanForProfiles(lastEvaluatedKey) {
    return new Promise(function(resolve, reject) {
        console.log('fetching', lastEvaluatedKey);
        documentClient.query({
            TableName: 'Overwatch_Profiles',
            Limit: 3000,
            AttributesToGet: ['username', 'timestamp'],
            ScanIndexForward: false,
            ExclusiveStartKey: lastEvaluatedKey,
            KeyConditions: {
                username: {
                    ComparisonOperator: 'EQ',
                    // AttributeValueList: ['Tr1ckyRabb1t:psn:global']
                        // AttributeValueList: ['rbouchoux:psn:global']
                        AttributeValueList: ['Ballsacian1:psn:global']
                        // AttributeValueList: ['Ballsacian1:psn:global', 'rbouchoux:psn:global', 'Tr1ckyRabb1t:psn:global']
                },
                timestamp: {
                    ComparisonOperator: 'BETWEEN',
                    AttributeValueList: [1488690000000, 1488724364684]
                }
            }
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

function batchDeleteProfiles(items) {
    var results = [],
        batch = items.slice(0, 25);

    console.log('Found', items.length, 'processing', batch.length);

    return new Promise(function(resolve, reject) {

        batch.forEach(function(item) {
            batchWrite.RequestItems.Overwatch_Profiles.push({
                DeleteRequest: {
                    Key: {
                        username: item.username,
                        timestamp: item.timestamp
                    }
                }
            });
        });

        if (batchWrite.RequestItems.Overwatch_Profiles.length > 0) {
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
    })
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

#! /app/.heroku/node/bin/node

'use strict';

var db = require('../app/db/adapter/dynamodb');

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

module.exports = function(username, startTime, endTime) {
    return new Promise(function(resolve, reject) {
        scanForProfiles(username, startTime, endTime).then(function(items) {
            try {
                console.log(JSON.stringify(resultItems));
                batchDeleteProfiles(resultItems).then(function() {
                    resolve(resultItems.length);
                }, reject);
            } catch (e) {
                reject();
            }
        }, onError);
    });
}


function scanForProfiles(username, startTime, endTime, lastEvaluatedKey) {
    return new Promise(function(resolve, reject) {
        console.log('fetching', username, lastEvaluatedKey);
        documentClient.query({
            TableName: 'Overwatch_Profiles',
            AttributesToGet: ['username', 'timestamp'],
            ScanIndexForward: false,
            ExclusiveStartKey: lastEvaluatedKey,
            KeyConditions: {
                username: {
                    ComparisonOperator: 'EQ',
                    AttributeValueList: [username]
                },
                timestamp: startTime && endTime ? {
                    ComparisonOperator: 'BETWEEN',
                    AttributeValueList: [startTime, endTime]
                } : undefined
            }
        }).promise().then(function(result) {
            resultItems = resultItems.concat(result.Items);
            if (result.Items.length > 0 && result.LastEvaluatedKey) {
                scanForProfiles(username, startTime, endTime, result.LastEvaluatedKey).then(function(innerResult) {
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

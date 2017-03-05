#! /app/.heroku/node/bin/node

'use strict';

var db = require('../app/db/adapter/dynamodb');

var documentClient = db.init({
    aws_access_key_id: process.env.AWS_ACCESS_KEY_ID,
    aws_secret_access_key: process.env.AWS_SECRET_ACCESS_KEY,
    aws_region: process.env.AWS_REGION,
    aws_url: undefined,
});

module.exports = function(username) {
    return scanForProfiles(username);
}

function scanForProfiles(username, lastEvaluatedKey) {
    var resultItems = [];
    return new Promise(function(resolve, reject) {
        console.log('fetching', username, lastEvaluatedKey);
        documentClient.scan({
            TableName: 'Overwatch_Profiles_Usernames',
            AttributesToGet: ['username'],
            ScanIndexForward: false,
            ExclusiveStartKey: lastEvaluatedKey,
            ScanFilter: {
                username: {
                    ComparisonOperator: 'CONTAINS',
                    AttributeValueList: [username]
                }
            }
        }).promise().then(function(result) {
            resultItems = resultItems.concat(result.Items);
            if (result.Items.length > 0 && result.LastEvaluatedKey) {
                scanForProfiles(username, result.LastEvaluatedKey).then(function(innerResult) {
                    resultItems = resultItems.concat(innerResult.Items || []);
                    resolve(resultItems);
                }, reject);
            } else {
                resolve(resultItems);
            }
        }, reject);
    });
}

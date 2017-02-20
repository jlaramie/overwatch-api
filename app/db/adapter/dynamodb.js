var AWS = require('aws-sdk'),
    client,
    Config;

function init(config) {
    Config = config;

    AWS.config.update({
        accessKeyId: config.aws_access_key_id,
        secretAccessKey: config.aws_secret_access_key,
        region: config.aws_region,
        endpoint: config.aws_url,
    });

    client = new AWS.DynamoDB.DocumentClient();

    return client;
}

module.exports = {
    init: init,
    getClient: function() {
        return client;
    }
};

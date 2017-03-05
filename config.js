var config = require('./config.json');

Object.keys(config).forEach(function(key) {
    process.env[key] = config[key];
});

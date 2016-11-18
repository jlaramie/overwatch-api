var oApi = require('./index'),
    Promise = require('promise');

try {
Promise.all([
    oApi.stats('psn', 'us', 'Ballsacian1').then(function(response) {
        console.log('Stats: \n' + JSON.stringify(response));
    }, function(error) {
        console.log('Stats Error: \n' + JSON.stringify(error));
    }),

    oApi.profile('psn', 'us', 'Ballsacian1').then(function(response) {
        console.log('Profile: \n' + JSON.stringify(response));
    }, function(error) {
        console.log('Profile Error: \n' + JSON.stringify(error));
    })
]).done(function() {
    process.exit();
}, function() {
    process.exit();
});
} catch(e) {
    console.log(e);
    process.exit();
}
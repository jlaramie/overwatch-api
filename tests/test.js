var oApi = require('../index');

try {
    Promise.all([
        oApi.data('psn', 'us', 'Ballsacian1').then(function(response) {
            console.log(JSON.stringify(response));
        }, function(error) {
            console.log('Stats Error: \n' + JSON.stringify(error));
        }),
    ]).done(function() {
        process.exit();
    }, function() {
        process.exit();
    });
} catch (e) {
    console.log(e);
    process.exit();
}

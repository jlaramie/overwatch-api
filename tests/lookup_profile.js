require('../config.js');

var startTime = Date.now();

require('../scripts/lookup_profile')('Ballsacian1').then(end, onError);

function onError(e) {
    console.log(e.stack || e.message);
    end();
}

function end(results) {
    var endTime = Date.now();
    console.log('End', (endTime - startTime) / 1000, JSON.stringify(results));
    process.exit();
}

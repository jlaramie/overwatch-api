require('../config.js');

var startTime = Date.now();

require('../scripts/fix_extra_profiles')('Ballsacian1:psn:global', 1488690000000, 1488724364684).then(end, onError);

function onError(e) {
    console.log(e.stack || e.message);
    end();
}

function end(results) {
    var endTime = Date.now();
    console.log('End', (endTime - startTime) / 1000, JSON.stringify(results));
    process.exit();
}

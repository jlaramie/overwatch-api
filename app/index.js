import index from './routes/index';
import data from './routes/data';
import profile from './routes/profile';
import stats from './routes/stats';
import badRequest from './routes/badRequest';
import db from './db/adapter/redis.js';

export default function(app) {
    db.init({
        redis_url: process.env.REDIS_URL
    }).then(function(client) {
        app.use('/', index);
        app.use('/data', data);
        app.use('/profile', profile);
        app.use('/stats', stats);
        app.use('*', badRequest);
    }, function(error) {
    	console.log('Error starting database', error);
    	process.exit(-1);
    });

}

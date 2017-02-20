import index from './routes/index';
import data from './routes/data';
import profile from './routes/profile';
import stats from './routes/stats';
import badRequest from './routes/badRequest';
import db from './db/adapter/redis.js';
import dynamodb from './db/adapter/dynamodb.js';

export default function(app) {
    dynamodb.init({
        aws_access_key_id: process.env.AWS_ACCESS_KEY_ID,
        aws_secret_access_key: process.env.AWS_SECRET_ACCESS_KEY,
        aws_region: process.env.AWS_REGION,
        aws_url: process.env.AWS_URL,
    });

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

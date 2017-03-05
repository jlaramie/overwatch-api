import index from './routes/index';
import data from './routes/data';
import profile from './routes/profile';
import stats from './routes/stats';
import lookup from './routes/lookup';
import badRequest from './routes/badRequest';
import dynamodb from './db/adapter/dynamodb.js';

export default function(app) {
    dynamodb.init({
        aws_access_key_id: process.env.AWS_ACCESS_KEY_ID,
        aws_secret_access_key: process.env.AWS_SECRET_ACCESS_KEY,
        aws_region: process.env.AWS_REGION,
        aws_url: process.env.AWS_URL,
    });

    app.use('/', index);
    app.use('/data', data);
    app.use('/profile', profile);
    app.use('/stats', stats);
    app.use('/lookup', lookup);
    app.use('*', badRequest);
}

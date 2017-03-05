var express = require('express'),
    router = express.Router(),
    db = require('../db/adapter/dynamodb');

/**
 * @api {get} /lookup/:username Perform lookup for usernames
 * @apiName LookupUsername
 * @apiGroup Lookup
 *
 * @apiParam {String} username in the form of ${tag}:${platform}:${region}. Only `tag` is required
 * @apiSuccess {Array} All matching full qualified usernames
 *
 * @apiExample {curl} Example usage:
 *  curl -i http://ow-api.herokuapp.com/lookup/user
 *
 * @apiSuccessExample {json} Success-Response:
    HTTP/1.1 200 OK
    [
      username: "user-1234:pc:eu"
    ]
 */
router.get('/:username', function(req, res) {
    var client = db.getClient();

    res.status(200).json([
        'user-1234:pc:eu'
    ]);
});

export default router;

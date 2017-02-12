const express = require('express');
const router = express.Router();

import parse from '../parser/profile';
import cache from '../cache';

/**
 * @api {get} /data/:platform/:region/:tag Get all data of player.
 * @apiName GetData
 * @apiGroup Data
 *
 * @apiParam {String} platform Name of user. pc/xbl/psn
 * @apiParam {String} region Region of player. us/eu/kr/cn/global
 * @apiParam {String} tag BattleTag of user. Replace # with -.
 * @apiSuccess {Object} data Profile and Stats data.
 *
 * @apiExample {curl} Example usage:
 *  curl -i http://ow-api.herokuapp.com/data/pc/us/user-12345
 *
 * @apiSuccessExample {json} Success-Response:
    HTTP/1.1 200 OK
    {
      username: "user",
      timestamp: "1486762656854",
      profile: {...}, // See profile response example
      stats: {...} // See stats response example
    }
 */
router.get('/:platform/:region/:tag', (req, res) => {
    var region = req.params.region;

    const platform = req.params.platform;
    const tag = req.params.tag;

    if(platform === 'psn' || platform === 'xbl') {
        region = 'global';
    }

    // const cacheKey = `profile_${platform}_${region}_${tag}`;
    const cacheKey = `Stats:Profiles:${tag}:${platform}:${region}`;
    const timeout = 60 * 5; // 5 minutes.

    cache.getOrSet(cacheKey, timeout, getProfile, true, function(err, data) {
        if (err) {
            res.status(500).json({
                error: 'Error retrieving profile'
            });
            console.log(err);
        } else {
            res.json(data);
        }
    });

    function getProfile(callback) {
        parse(platform, region, tag).then(function(data) {
            if (callback) {
                callback(null, data, data.timestamp);
            }
        }, function(err) {
            if (callback) {
                callback(err);
            }
        });
    }
});

export default router;

const express = require('express');
const router = express.Router();

import parse from '../parser/profile';
import cache from '../cache';

/**
 * @api {get} /stats/:platform/:region/:tag Get profile of player.
 * @apiName GetStats
 * @apiGroup Stats
 *
 * @apiParam {String} platform Name of user. pc/xbl/psn
 * @apiParam {String} region Region of player. us/eu/kr/cn/global
 * @apiParam {String} tag BattleTag of user. Replace # with -.
 * @apiSuccess {Object} data Profile data.
 *
 * @apiExample {curl} Example usage:
 *  curl -i http://ow-api.herokuapp.com/stats/pc/us/user-12345
 *
 * @apiSuccessExample {json} Success-Response:
    HTTP/1.1 200 OK
    {
      username: "user",
      timestamp: "1486762656854",
      stats: {
        competitive: {
          featured: {...},
          topHeroes: [...],
          careerStats: {...}
        },
        quickplay: {
          featured: {...},
          topHeroes: [...],
          careerStats: {...}
        }
      }
    }
 */
router.get('/:platform/:region/:tag', (req, res) => {

    const platform = req.params.platform;
    const region = req.params.region;
    const tag = req.params.tag;

    const cacheKey = `profile_${platform}_${region}_${tag}`;
    const timeout = 60 * 5; // 5 minutes.

    cache.getOrSet(cacheKey, timeout, getStats, function(err, data) {
        if (err) {
            res.status(500).json({
                error: 'Error retrieving stats'
            });
            console.log(err);
        } else {
            res.json({
                username: data.username,
                stats: data.stats
            });
        }
    });

    function getStats(callback) {
        parse(platform, region, tag).then(function(data) {
            if (callback) {
                callback(null, data);
            }
        }, function(err) {
            if (callback) {
                callback(err);
            }
        });
    }
});

export default router;

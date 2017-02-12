const express = require('express');
const router = express.Router();

import parse from '../parser/profile';
import cache from '../cache';

/**
 * @api {get} /profile/:platform/:region/:tag Get profile of player.
 * @apiName GetProfile
 * @apiGroup Profile
 *
 * @apiParam {String} platform Name of user. pc/xbl/psn
 * @apiParam {String} region Region of player. us/eu/kr/cn/global
 * @apiParam {String} tag BattleTag of user. Replace # with -.
 * @apiSuccess {Object} data Profile data.
 *
 * @apiExample {curl} Example usage:
 *  curl -i http://ow-api.herokuapp.com/profile/pc/us/user-12345
 *
 * @apiSuccessExample {json} Success-Response:
    HTTP/1.1 200 OK
    {
      username: "user",
      timestamp: "1486762656854",
      profile: {
        avatar: "https://blzgdapipro-a.akamaihd.net/game/unlocks/0x0250000000000EFD.png",
        games: {
          quickplay: {
            wins: 252
          },
          competitive: {
            wins: 9,
            lost: 18,
            played: 27,
            tied: 19,
            winPercentage: 46
          }
        },
        playtime: {
          quickplay: 63, // in hours
          competitive: 5 // in hours
        },
        competitive: {
          rank: 2083,
          rank_img: "https://blzgdapipro-a.akamaihd.net/game/rank-icons/rank-10.png"
        },
        level: 40,
        levelFrame: "https://blzgdapipro-a.akamaihd.net/game/playerlevelrewards/0x025000000000091F_Border.png",
        star: "https://blzgdapipro-a.akamaihd.net/game/playerlevelrewards/0x0250000000000939_Rank.png",
        prestige: 4,
        levelFull: 440
      }
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
            res.json({
                username: data.username,
                timestamp: data.timestamp,
                profile: data.profile
            });
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

const express = require('express');
const router = express.Router();

import parse from '../parser/profile';
import cache from '../cache';
import deepEqual from 'deep-equal';

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
      lastChecked: "1486762656854",
      isRefreshing: false,
      profile: {...}, // See profile response example
      stats: {...} // See stats response example
    }
 */
router.get('/:platform/:region/:tag', (req, res) => {
    var region = req.params.region;

    const platform = req.params.platform;
    const tag = req.params.tag;

    if (platform === 'psn' || platform === 'xbl') {
        region = 'global';
    }

    const cacheKey = `Stats:Profiles:${tag}:${platform}:${region}`;
    const timeout = 60 * 5 * 1000; // 5 minutes.

    cache.getOrSet(cacheKey, timeout, getProfile, isNewProfile, true, function(error, data) {
        if (error) {
            console.log(`Error retrieving profile for ${tag} ${platform} ${region}`, error.name, error.statusCode);
            res.status(500).json({
                error: `Error retrieving profile for ${tag} ${platform} ${region}`
            });
        } else {
            res.json({
                username: data.username,
                timestamp: data.timestamp,
                lastChecked: data.lastChecked,
                isRefreshing: data.isRefreshing,
                profile: data.profile,
                stats: data.stats
            });
        }
    });

    function getProfile(callback) {
        parse(platform, region, tag).then(function(data) {
            if (callback) {
                callback(null, data);
            }
        }, function(error) {
            if (callback) {
                callback(error);
            }
        });
    }

    function isNewProfile(oldData, newData) {
        var isNew = false,
            oldCompetitiveStats,
            oldQuickplayStats,
            newCompetitiveStats,
            newQuickplayStats,
            isQuickplayChanged,
            isCompetitiveChanged,
            isRankChanged;

        try {
            oldCompetitiveStats = oldData.stats.competitive.careerStats.allHeroes;
            newCompetitiveStats = newData.stats.competitive.careerStats.allHeroes;
            oldQuickplayStats = oldData.stats.quickplay.careerStats.allHeroes;
            newQuickplayStats = newData.stats.quickplay.careerStats.allHeroes;
            isQuickplayChanged = !deepEqual(oldQuickplayStats, newQuickplayStats);
            isCompetitiveChanged = !deepEqual(oldCompetitiveStats, newCompetitiveStats);
            isRankChanged = newData.profile.competitive.rank && oldData.profile.competitive.rank !== newData.profile.competitive.rank;

            isNew = isRankChanged || isQuickplayChanged || isCompetitiveChanged;

            console.log('Comparing', isNew, oldData.timestamp, newData.timestamp, isQuickplayChanged, isCompetitiveChanged);
        } catch (error) {
            console.log('Error comparing data', error);
        }

        return isNew;
    }
});

export default router;

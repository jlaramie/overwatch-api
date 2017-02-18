const express = require('express');
const router = express.Router();
const heroes = ['ana', 'bastion', 'dva', 'genji', 'hanzo', 'junkrat', 'lucio', 'mccree', 'mei', 'mercy', 'pharah', 'reaper', 'reinhardt', 'roadhog', 'soldier76', 'sombra', 'symmetra', 'torbjorn', 'tracer', 'widowmaker', 'winston', 'zarya', 'zenyatta'];
const heroMap = {
    soldier76: 'soldier:76',
    torbjorn: 'torbjörn',
    lucio: 'lúcio'
};

function ucwords(str) {
    //  discuss at: http://locutus.io/php/ucwords/
    // original by: Jonas Raoni Soares Silva (http://www.jsfromhell.com)
    // improved by: Waldo Malqui Silva (http://waldo.malqui.info)
    // improved by: Robin
    // improved by: Kevin van Zonneveld (http://kvz.io)
    // bugfixed by: Onno Marsman (https://twitter.com/onnomarsman)
    //    input by: James (http://www.james-bell.co.uk/)
    //   example 1: ucwords('kevin van  zonneveld')
    //   returns 1: 'Kevin Van  Zonneveld'
    //   example 2: ucwords('HELLO WORLD')
    //   returns 2: 'HELLO WORLD'

    return (str + '').replace(/^([a-z\u00E0-\u00FC])|\s+([a-z\u00E0-\u00FC])/g, function($1) {
        return $1.toUpperCase()
    });
}

import parse from '../parser/profile';
import cache from '../cache';
import deepEqual from 'deep-equal';

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
      lastChecked: "1486762656854",
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
    var region = req.params.region;

    const platform = req.params.platform;
    const tag = req.params.tag;
    const hero = (req.query.hero || '').toLowerCase();

    if (platform === 'psn' || platform === 'xbl') {
        region = 'global';
    }

    const cacheKey = `${tag}:${platform}:${region}`;
    const timeout = 60 * 5 * 1000; // 5 minutes.

    cache.getOrSet('Stats:Profiles', cacheKey, timeout, getStats, isNewProfile, true, 'Queue:Profiles', function(error, data) {
        var heroName = hero && heroes.indexOf(hero) !== -1 ? (heroMap[hero] || hero) : undefined,
            response;

        if (error) {
            console.log(`Error retrieving profile for ${tag} ${platform} ${region}`, error.name, error.statusCode);
            res.status(500).json({
                error: `Error retrieving profile for ${tag} ${platform} ${region}`
            });
        } else if (data) {
            if (heroName) {
                response = {
                    username: data.username,
                    timestamp: data.timestamp,
                    lastChecked: data.lastChecked,
                    hero: {
                        name: heroName
                    }
                };

                // Populate stats that are available
                Object.keys(data.stats).forEach(function(mode) {
                    if (data.stats[mode] && data.stats[mode].careerStats) {
                        response.hero[mode] = data.stats[mode].careerStats[heroName];
                    }
                });
            } else {
                response = {
                    username: data.username,
                    timestamp: data.timestamp,
                    lastChecked: data.lastChecked,
                    stats: data.stats
                };
            }
        } else {
            res.status(404).json({
                error: `Profile has been added to the queue for ${tag} ${platform} ${region}`
            });
        }
        res.json(response);
    });

    function getStats(callback) {
        parse(platform, region, tag).then(function(data) {
            if (callback) {
                callback(null, data, data.timestamp);
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
            isRankChanged,
            oldComp = oldData.stats.competitive,
            newComp = newData.stats.competitive,
            oldQuick = oldData.stats.quickplay,
            newQuick = newData.stats.quickplay,
            oldRank = oldData.profile.competitive ? oldData.profile.competitive.rank : 0,
            newRank = newData.profile.competitive ? newData.profile.competitive.rank : 0;

        try {
            oldCompetitiveStats = oldComp && oldComp.careerStats ? oldComp.careerStats.allHeroes : undefined;
            newCompetitiveStats = newComp && newComp.careerStats ? newComp.careerStats.allHeroes : undefined;
            oldQuickplayStats = oldQuick && oldQuick.careerStats ? oldQuick.careerStats.allHeroes : undefined;
            newQuickplayStats = newQuick && newQuick.careerStats ? newQuick.careerStats.allHeroes : undefined;
            isQuickplayChanged = !deepEqual(oldQuickplayStats, newQuickplayStats);
            isCompetitiveChanged = !deepEqual(oldCompetitiveStats, newCompetitiveStats);
            isRankChanged = oldRank !== newRank;

            isNew = isRankChanged || isQuickplayChanged || isCompetitiveChanged;

            console.log('Comparing', isNew, oldData.timestamp, newData.timestamp, isQuickplayChanged, isCompetitiveChanged);
        } catch (error) {
            console.log('Error comparing data', error);
        }

        return isNew;
    }
});

export default router;

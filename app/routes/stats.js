const express = require('express');
const router = express.Router();
const heroes = ['ana', 'bastion', 'dva', 'genji', 'hanzo', 'junkrat', 'lucio', 'mccree', 'mei', 'mercy', 'pharah', 'reaper', 'reinhardt', 'roadhog', 'solder76', 'sombra', 'symmetra', 'torbjorn', 'tracer', 'windowmaker', 'winston', 'zarya', 'zenyatta'];
const heroMap = {
    soldier76: 'soldier:76',
    torbjorn: 'torbjörn',
    dva: 'd.va',
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
    const hero = (req.query.hero || '').toLowerCase();

    const cacheKey = `profile_${platform}_${region}_${tag}`;
    const timeout = 60 * 5; // 5 minutes.

    cache.getOrSet(cacheKey, timeout, getStats, function(err, data) {
        var heroName = hero && heroes.indexOf(hero) !== -1 ? (heroMap[hero] || hero) : undefined;

        if (err) {
            res.status(500).json({
                error: 'Error retrieving stats'
            });
            console.log(err);
        } else if (heroName) {
            res.json({
                username: data.username,
                timestamp: data.timestamp,
                hero: {
                    name: heroName,
                    quickplay: data.stats.quickplay.careerStats[heroName],
                    competitive: data.stats.competitive.careerStats[heroName]
                }
            });
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

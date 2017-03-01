const cheerio = require('cheerio');
const rp = require('request-promise');
const Promise = require('promise');
const trim = require('trim');
const moment = require('moment');
const _ = require('underscore');
const Utilities = require('../utilities');

function toCamelCase(str) {
    return str
        .replace(/-/g, ' ')
        .replace(/\s(.)/g, function($1) {
            return $1.toUpperCase();
        })
        .replace(/\s/g, '')
        .replace(/^(.)/, function($1) {
            return $1.toLowerCase();
        });
}

function timeToSeconds(value) {
    var timeInSeconds = 0;

    value.split(':').reverse().map(function(part, i) {
        return parseInt(part, 10) * ((60 * i) || 1);
    }).forEach(function(seconds) {
        timeInSeconds = timeInSeconds + seconds;
    });

    return timeInSeconds;
}

function formatValue(value) {
    // Strip out commas
    value = value.replace(/,/g, '');

    var timeStrings = ['second', 'seconds', 'minute', 'minutes', 'hour', 'hours', 'day', 'days', 'week', 'weeks'],
        parts = value.split(' ');

    if (value.indexOf(':') !== -1) {
        value = timeToSeconds(value);
    } else if (value[value.length - 1] === '%') {
        value = parseInt(value.substring(0, value.length - 1), 10);
    } else if (timeStrings.indexOf(parts[1]) !== -1) {
        value = moment.duration(parseInt(parts[0]), parts[1].toLowerCase()).asSeconds();
    } else if (value === '--') {
        value = 0;
    } else if (value.indexOf('.') !== -1) {
        value = parseFloat(value);
    } else {
        value = parseInt(value, 10);
    }

    return value;
}

function getHeroImage(guid) {
    try {
        if (guid === '0x02E00000FFFFFFFF') {
            // Empty guid
            return undefined;
        }

        return `https://blzgdapipro-a.akamaihd.net/game/heroes/small/${guid}.png`;
    } catch (e) {
        console.log(e);
    }
}

// export default function(platform, region, tag, cb) {
// Ballsacian1
// 53800040
// https://playoverwatch.com/en-us/career/get-platforms/53800040
module.exports = function(platform, region, tag, cb) {
    platform = (platform || '').toLowerCase();
    region = (region || '').toLowerCase();

    const url = platform === 'psn' || platform === 'xbl' ? `https://playoverwatch.com/en-us/career/${platform}/${tag}` : `https://playoverwatch.com/en-us/career/${platform}/${region}/${tag}`;
    const promise = new Promise(function(resolve, reject) {
        rp(url).then((htmlString) => {
            try {
                // Begin html parsing.
                const $ = cheerio.load(htmlString);
                const user = $('.header-masthead').text();
                const modes = ['quickplay', 'competitive'];
                const stats = {
                    competitive: {
                        featured: getFeaturedStats('competitive'),
                        topHeroes: getTopHeroStats('competitive'),
                        careerStats: getCareerStats('competitive')
                    },
                    quickplay: {
                        featured: getFeaturedStats('quickplay'),
                        topHeroes: getTopHeroStats('quickplay'),
                        careerStats: getCareerStats('quickplay')
                    }
                };

                /**
                 * Since some people don't have quickplay and/or competitve stats I added checks to handle this.
                 * Redis hates empty objects and hates undefined
                 */
                Object.keys(stats).forEach(function(mode) {
                    Object.keys(stats[mode]).forEach(function(category) {
                        if (_.isEmpty(stats[mode][category])) {
                            delete stats[mode][category];
                        }
                    });
                    if (_.isEmpty(stats[mode])) {
                        delete stats[mode];
                    }
                });

                const profile = {
                    username: user,
                    avatarImg: $('.player-portrait').attr('src'),
                    games: {
                        quickplay: {
                            wins: stats.quickplay.careerStats ? stats.quickplay.careerStats.allHeroes.game.gamesWon : 0
                        }
                    },
                    playtime: {
                        quickplay: stats.quickplay.careerStats ? stats.quickplay.careerStats.allHeroes.game.timePlayed : 0,
                        competitive: stats.competitive.careerStats ? stats.competitive.careerStats.allHeroes.game.timePlayed : 0
                    },
                    competitive: {
                        rank: parseInt($('.competitive-rank div').first().text(), 10),
                        rankImg: $('.competitive-rank img').attr('src') || ''
                    },
                    level: parseInt($('.player-level .u-vertical-center').first().text(), 10),
                    levelFrameImg: $('.player-level').attr('style').slice(21, 109),
                    starImg: ($('.player-level .player-rank').attr('style') || '').slice(21, 107),
                    prestige: 0,
                    levelFull: 0
                };

                if (stats.competitive.careerStats) {
                    profile.games.competitive = {
                        wins: stats.competitive.careerStats.allHeroes.game.gamesWon,
                        lost: stats.competitive.careerStats.allHeroes.miscellaneous.gamesLost,
                        tied: stats.competitive.careerStats.allHeroes.miscellaneous.gamesTied,
                        winPercentage: (stats.competitive.careerStats.allHeroes.game.gamesWon / stats.competitive.careerStats.allHeroes.game.gamesPlayed) * 100
                    };
                }

                // If user has not played competitve they will have no rank and no rankImg
                if (_.isNaN(profile.competitive.rank)) {
                    delete profile.competitive;
                }

                if(!profile.starImg) {
                    delete profile.starImg;
                }

                profile.prestige = profile.starImg ? Utilities.getPrestige(profile.starImg.match(/0x([0-9a-f]*)/i)[0]) : 0;
                profile.levelFull = (profile.prestige * 100) + profile.level;
                /**
                 * Iterates over the Top Heroes dropdown to collect stats for all the top heroes.
                 * The stats are organized by hero before being put into an array of heroes with stats.
                 * [{
                 *     hero: Reinhardt,
                 *     img: https://blzgdapipro-a.akamaihd.net/game/heroes/small/0x02E0000000000007.png,
                 *     timePLayed: 59,
                 *     gamesWon: 129,
                 *     winPercentage: 47,
                 *     weaponAccuracy: 0,
                 *     eliminationsPerLife: 1,
                 *     multikillBest: 5,
                 *     objectKillsAverage: 9
                 * }]
                 */
                function getTopHeroStats(mode) {
                    var stats = [],
                        statsAvailable = [],
                        statsByHeroes = {}

                    // Get all the top hero stats, their names, and guid
                    const $availableStats = $(`#${mode} [data-group-id="comparisons"] option`);
                    $availableStats.each(function(i, el) {
                        var stat = {},
                            $el = $(el);

                        stat.name = $el.attr('option-id');
                        stat.id = $el.attr('value');
                        stat.guid = $el.attr('value');
                        stat.key = toCamelCase(stat.name);

                        statsAvailable.push(stat);
                    });

                    // Iterate over available top hero stats 
                    statsAvailable.forEach(function(statInfo) {
                        const $heroEls = $(`#${mode} [data-category-id="${statInfo.id}"]`).find('.progress-category-item');

                        // Iterate over the heroes and reutrn the stats
                        $heroEls.each(function(i, el) {
                            var $el = $(el);
                            const heroName = $el.find('.title').text();
                            const stat = statsByHeroes[heroName] = statsByHeroes[heroName] || {};
                            const value = $el.find('.description').text().trim();

                            stat.name = heroName;
                            stat.guid = $el.find('img').attr('src').match(/0x([0-9a-f]*)/i)[0];
                            stat.img = getHeroImage(stat.guid);

                            stat[statInfo.key] = formatValue(value);
                        });

                    });

                    // Add heroes with their stats to the stats array
                    Object.keys(statsByHeroes).forEach(function(key) {
                        stats.push(statsByHeroes[key]);
                    });

                    return stats;
                }

                /**
                 * Returns featured stats object keyed by the stat name in camelCase and with the value parsed
                 * {
                 *    eliminationsAverage: 21.9,
                 *    damageDoneAverage: 11,
                 *    deathsAverage: 11.1,
                 *    finalBlowsAverage: 11.26,
                 *    healingDoneAverage: 1,
                 *    objectiveKillsAverage: 10.01,
                 *    objectiveTimeAverage: 126,
                 *    soloKillsAverage: 1.37
                 * }
                 */
                function getFeaturedStats(mode) {
                    var $featuredEls = $(`#${mode} section.highlights-section .card`),
                        stats = {};

                    $featuredEls.each(function() {
                        var $el = $(this),
                            key = toCamelCase($el.find('.card-copy').text()),
                            value = $el.find('.card-heading').text();

                        stats[key] = formatValue(value);
                    });

                    return stats;
                }

                /**
                 * Returns career stats for items in the career stats dropdown
                 * {
                 *     allHeroes: {
                 *         combat: {
                 *             meleeFinalBlows: 70
                 *         },
                 *         deaths: {}
                 *     }
                 * }
                 */
                function getCareerStats(mode) {
                    var stats = {},
                        groups = $(`#${mode} select[data-group-id="stats"] option`).map(function() {
                            // All Heroes, Reinhardt, etc..
                            var stat = {},
                                $el = $(this);

                            stat.name = $el.attr('option-id');
                            stat.id = $el.attr('value');
                            stat.key = toCamelCase(stat.name.toLowerCase());

                            return stat;
                        }).get();

                    groups.forEach(function(group) {
                        stats[group.key.replace('.', '')] = getCategoryStats(mode, group);
                    });

                    return stats;
                }

                /**
                 * Returns stats for a given group
                 * {
                 *     combat: {
                 *         meleeFinalBlows: 70
                 *     }
                 * }
                 */
                function getCategoryStats(mode, group) {
                    var stats = {},
                        statCategories = [
                            'Combat',
                            'Deaths',
                            'Match Awards',
                            'Assists',
                            'Average',
                            'Miscellaneous',
                            'Best',
                            'Game',
                            'Hero Specific',
                        ];

                    stats.heroDetails = {
                        guid: group.id,
                        name: group.name,
                        img: getHeroImage(group.id)
                    };

                    if(!stats.heroDetails.img) {
                        delete stats.heroDetails.img;
                    }

                    statCategories.forEach(function(category) {
                        var $els = $(`#${mode} [data-category-id="${group.id}"] span:contains("${category}")`).closest('table').find('tbody tr'),
                            categoryStats = {},
                            key = toCamelCase(category);

                        $els.each(function() {
                            var $el = $(this),
                                title = $el.find('td').first().text(),
                                key = toCamelCase(title.toLowerCase()),
                                value = $el.find('td').next().text();

                            categoryStats[key] = formatValue(value);
                        });

                        if ($els.length > 0) {
                            stats[key] = categoryStats
                        }
                    });

                    return stats;
                }

                const json = {
                    username: `${user}:${platform}:${region}`,
                    timestamp: parseInt(moment().format('x'), 10),
                    profile: profile,
                    stats: stats,
                }

                cb && cb(null, json);
                resolve(json);
            } catch (e) {
                reject(e);
            }
        }).catch(err => {
            if (err.statusCode !== 404) {
                console.log('Profile Parser Error', err.stack);
            }
            cb && cb(err);
            reject(err);
        });
    });

    return promise;
}

const cheerio = require('cheerio');
const rp = require('request-promise');
const Promise = require('promise');
const trim = require('trim');
const moment = require('moment');

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
    var timeStrings = ['seconds', 'minutes', 'hours', 'days'],
        parts = value.split(' ');

    if (value.indexOf(':') !== -1) {
        value = timeToSeconds(value);
    } else if (value[value.length - 1] === '%') {
        value = parseInt(value.substring(0, value.length - 1), 10);
    } else if (timeStrings.indexOf(parts[1]) !== -1) {
        value = moment.duration(parseInt(parts[0]), parts[1].toLowerCase()).asHours();
    } else if (value === '--') {
        value = 0;
    } else if (value.indexOf('.') !== -1) {
        value = parseFloat(value);
    } else {
        value = parseInt(value, 10);
    }

    return value;
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

                            stat.hero = heroName;
                            stat.img = $el.find('img').attr('src');

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
                        stats[group.key] = getCategoryStats(mode, group);
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
                    username: user,
                    stats: stats
                }

                cb && cb(null, json);
                resolve(json);
            } catch (e) {
                reject(e);
            }
        }).catch(err => {
            cb && cb(err);
            reject(err);
        });
    });

    return promise;
}

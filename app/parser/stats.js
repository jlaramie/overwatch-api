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

// export default function(platform, region, tag, cb) {
module.exports = function(platform, region, tag, cb) {
    platform = (platform || '').toLowerCase();
    region = (region || '').toLowerCase();

    const url = platform === 'psn' || platform === 'xbl' ? `https://playoverwatch.com/en-us/career/${platform}/${tag}` : `https://playoverwatch.com/en-us/career/${platform}/${region}/${tag}`;
    const sortBy = 'all';
    const promise = new Promise(function(resolve, reject) {
        rp(url).then((htmlString) => {
            try {
                // Begin html parsing.
                const $ = cheerio.load(htmlString);
                const user = $('.header-masthead').text();

                const stats = {
                    top_heroes: {}
                };

                const availableHeroStats = {
                    competitive: [],
                    quickplay: []
                };

                const statsByHeroes = {
                    competitive: {},
                    quickplay: {},
                };

                // Get all the availble stats, their names, and guid
                Object.keys(availableHeroStats).forEach(function(mode) {
                    const statsForMode = availableHeroStats[mode];
                    const availableStats = $(`#${mode} [data-group-id="comparisons"] option`);

                    availableStats.each(function(i, el) {
                        var stat = {};

                        stat.name = $(this).attr('option-id');
                        stat.id = $(this).attr('value');
                        stat.key = toCamelCase(stat.name);

                        statsForMode.push(stat);
                    });
                });

                // Iterate over stats for a given mode and populate stats data
                function populateTopHeroStats(mode) {
                    var topHeroStats = {};

                    stats.top_heroes[mode] = [];

                    availableHeroStats[mode].forEach(function(statInfo) {
                        const heroEls = $(`#${mode} [data-category-id="${statInfo.id}"]`).find('.progress-category-item');

                        heroEls.each(function(i, el) {
                            const heroName = $(this).find('.title').text();
                            const stat = statsByHeroes[mode][heroName] = statsByHeroes[mode][heroName] || {};
                            const value = trim($(this).find('.description').text());

                            stat.hero = $(this).find('.title').text();
                            stat.img = $(this).find('img').attr('src');

                            switch (statInfo.key) {
                                case 'timePlayed':
                                    const valueSplit = value.split(' ');
                                    stat[statInfo.key] = value === '--' ? 0 : moment.duration(parseInt(valueSplit[0]), valueSplit[1].toLowerCase()).asHours();
                                    break;
                                case 'weaponAccuracy':
                                    stat[statInfo.key] = parseInt(value.replace('%', ''), 10);
                                    break;
                                default:
                                    stat[statInfo.key] = parseInt(value, 10);
                                    break;
                            }

                            if (stats['top_heroes'][mode].indexOf(stat) === -1) {
                                stats['top_heroes'][mode].push(stat);
                            }
                        });
                    });
                }

                // 
                // Top Heroes.
                // 
                populateTopHeroStats('quickplay');
                populateTopHeroStats('competitive');

                //
                // Career Stats
                //
                const statCategories = [
                    'Combat',
                    'Deaths',
                    'Match Awards',
                    'Assists',
                    'Average',
                    'Miscellaneous',
                    'Best',
                    'Game'
                ];

                // Quickplay Stats.
                statCategories.forEach(function(item) {
                    const els = $(`#quickplay [data-category-id="0x02E00000FFFFFFFF"] span:contains("${item}")`).closest('table').find('tbody tr');
                    let statsArr = [];
                    els.each(function(i, el) {
                        let stat = {};
                        stat.title = $(this).find('td').first().text();
                        stat.value = $(this).find('td').next().text();
                        statsArr.push(stat);
                    });
                    item = item.replace(' ', '_').toLowerCase();
                    stats[item] = { quickplay: [] };
                    stats[item]['quickplay'] = statsArr;
                });

                // Competitive Stats.
                statCategories.forEach(function(item) {
                    const els = $(`#competitive [data-category-id="0x02E00000FFFFFFFF"] span:contains("${item}")`).closest('table').find('tbody tr');
                    let statsArr = [];
                    els.each(function(i, el) {
                        let stat = {};
                        stat.title = $(this).find('td').first().text();
                        stat.value = $(this).find('td').next().text();
                        statsArr.push(stat);
                    });
                    item = item.replace(' ', '_').toLowerCase();
                    stats[item]['competitive'] = [];
                    stats[item]['competitive'] = statsArr;
                });

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

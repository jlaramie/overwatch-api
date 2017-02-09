const cheerio = require('cheerio');
const rp = require('request-promise');
const Promise = require('promise');
const Utilities = require('../utilities');

// export default function(platform, region, tag, cb) {
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
                const avatar = $('.player-portrait').attr('src');
                const playerLevel = parseInt($('.player-level .u-vertical-center').first().text(), 10);
                const won = {};
                const lost = {};
                const played = {};
                const tied = {};
                const time = {};

                let compRank;
                let compRankImg;
                let star = '';
                let playerPrestige = 0;

                const quickplayWonEl = $('#quickplay td:contains("Games Won")').next().html();
                const quickplayPlayedEl = $('#quickplay td:contains("Games Played")').next().html();
                const quickplayTimePlayedEl = $('#quickplay td:contains("Time Played")').next().html();

                const compWonEl = $('#competitive td:contains("Games Won")').next().html();
                const compPlayedEl = $('#competitive td:contains("Games Played")').next().html();
                const compTiedEl = $('#competitive td:contains("Games Tied")').next().html();
                const compLostEl = $('#competitive td:contains("Games Lost")').next().html();
                const compTimePlayedEl = $('#competitive td:contains("Time Played")').next().html();
                const compRankEl = $('.competitive-rank');

                const levelFrame = $('.player-level').attr('style').slice(21, 109);
                const starEl = $('.player-level .player-rank').html();

                if (compRankEl !== null) {
                    compRankImg = $('.competitive-rank img').attr('src');
                    compRank = $('.competitive-rank div').html();
                }

                if (quickplayWonEl !== null) {
                    won.quickplay = quickplayWonEl.trim().replace(/,/g, '');
                }

                if (quickplayPlayedEl !== null) {
                    played.quickplay = quickplayPlayedEl.trim().replace(/,/g, '');
                    lost.quickplay = played.quickplay - won.quickplay;
                }

                if (quickplayTimePlayedEl !== null) {
                    time.quickplay = quickplayTimePlayedEl.trim().replace(/,/g, '');
                }

                if (compWonEl !== null) {
                    won.competitive = compWonEl.trim().replace(/,/g, '');
                }

                if (compPlayedEl !== null) {
                    played.competitive = compPlayedEl.trim().replace(/,/g, '');
                    // lost.competitive = played.competitive - won.competitive;
                }

                if (compTiedEl !== null) {
                    tied.competitive = compTiedEl.trim().replace(/,/g, '');
                }

                if (compLostEl !== null) {
                    lost.competitive = compLostEl.trim().replace(/,/g, '');
                }

                if (compTimePlayedEl !== null) {
                    time.competitive = compTimePlayedEl.trim().replace(/,/g, '');
                }

                if (starEl !== null) {
                    star = $('.player-level .player-rank').attr('style').slice(21, 107);
                    playerPrestige = Utilities.getPrestige(star.match(/0x([0-9a-f]*)/i)[0]);
                }

                const json = {
                    username: user,
                    avatar: avatar,
                    games: {
                        quickplay: { wins: won.quickplay, lost: lost.quickplay, played: played.quickplay },
                        competitive: {
                            wins: won.competitive,
                            lost: lost.competitive,
                            played: played.competitive,
                            tied: tied.competitive,
                            winPercentage: parseInt(won.competitive) / parseInt(played.competitive) * 100
                        },
                    },
                    playtime: { quickplay: time.quickplay, competitive: time.competitive },
                    competitive: { rank: compRank, rank_img: compRankImg },
                    level: playerLevel,
                    prestige: playerPrestige,
                    levelFull: (playerPrestige * 100) + playerLevel,
                    levelFrame: levelFrame,
                    star: star
                }

                cb && cb(null, json);
                resolve(json);
            } catch (err) {
                reject(err);
            }
        }).catch(err => {
            cb && cb(err);
            reject(err);
        });
    });

    return promise;
}

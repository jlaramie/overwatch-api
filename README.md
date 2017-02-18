# Overwatch API
An unofficial [Overwatch](https://playoverwatch.com) HTTP API, built with NodeJS.

**Currently a work-in-progress project!**

![](overwatch.jpg)

[![npm](https://img.shields.io/npm/v/overwatch-api.svg?maxAge=2592000)]()

## Features
* Profile Data
* Career Stats

## API Docs
See: https://ow-api.herokuapp.com/docs/

## Demo

```
curl http://ow-api.herokuapp.com/profile/pc/us/Alf-1608
```
```json
{
    "username": "Alf",
    "games": {
        "quickplay": {
            "wins": "508"
        },
        "competitive": {
            "wins": "11",
            "lost": 21,
            "played": "32"
        }
    },
    "playtime": {
        "quickplay": "122 hours",
        "competitive": "6 hours"
    },
    "competitive": {
        "rank": "2073",
        "rank_img": "https://blzgdapipro-a.akamaihd.net/game/rank-icons/rank-10.png"
    },
    "levelFrame": "https://blzgdapipro-a.akamaihd.net/game/playerlevelrewards/0x0250000000000928_Border.png",
    "star": "https://blzgdapipro-a.akamaihd.net/game/playerlevelrewards/0x0250000000000928_Rank.png"
}
```

Please note, the hosted Heroku app above is for development and testing purposes only and not to be used in production. We recommend deploying a copy of this project on your own server.

A production-ready hosted service is TBD.

Or deploy your own Heroku instance!

[![Deploy](https://www.herokucdn.com/deploy/button.svg)](https://heroku.com/deploy?template=https://github.com/alfg/overwatch-api)


## Install

#### Requirements
* Node v6.0+

```bash
git clone https://github.com/alfg/overwatch-api.git
cd overwatch-api
npm install
npm start
```

#### Development
This project is built using [srv](https://github.com/alfg/srv), a microservices stack based on [express](https://expressjs.com/). After installation, run the project using the following:

```bash
node node_modules/srv-cli/build/srv app/index.js
```

[nodemon](https://github.com/remy/nodemon) is recommended for auto-reloading during development:
```bash
nodemon node_modules/srv-cli/build/srv app/index.js
```

Generate docs with the `--docs app/routes` flag.

See [srv](https://github.com/alfg/srv) documentation for more info on srv specific options.

## License
GPL 2.0

## Heroku Setup
heroku addons:docs scheduler
https://scheduler.heroku.com/dashboard
git push heroku master
heroku ps:scale web=0 worker=0
web: node --inspect --debug-brk node_modules/srv-cli/build/srv app/index.js --docs app/routes


https://playoverwatch.com/en-us/career/get-platforms/53800040

</script><script type="text/template" id="platform-btn-template"><a href="<%= careerLink %>" class="button m-white m-sm <%= classes %>"><%= platformName %></a></script><script>window.app.career.init(53800040, 'psn', 'global');


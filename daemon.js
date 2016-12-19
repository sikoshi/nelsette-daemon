var request  = require('request');
var cheerio  = require('cheerio');
var config   = require('config');
var fs       = require('fs');
var swig     = require('swig');
var template = swig.compileFile('templates/new_match.tpl');

var ignored_pitches = [];

// Loading config

if (config.has('ignore_list.pitches'))
{
    ignored_pitches = config.get('ignore_list.pitches');
}

if (config.has('telegram_bot'))
{
    var telegram_bot_token = config.get('telegram_bot.bot_token');
    var telegram_chat_id   = config.get('telegram_bot.chat_id');
}

if ((typeof(telegram_bot_token) == 'undefined') || (typeof(telegram_chat_id) == 'undefined'))
{
    console.log('No telegram config');
    return false;
}

// TODO: accept params via GET

// state
var state = 'upcoming';
// currency

var currency = 'KZT';

// stating price
var starting_price = 0;

// ending price
var ending_price = 374220;

// order
var order = 1;

// city
var city = '1526384';

// Url to request
var nelsette_url = 'http://nelsette.com/qm/upcoming?state=' + state + '&currency=' + currency + '&sp=' + starting_price + '&ep=' + ending_price + '&ord=' + order + '&city=' + city;

// Requesting matches page
request({ encoding: null, method: "GET", uri: nelsette_url}, function (error, response, body) {
    if (!error && response.statusCode == 200)
    {
        var last_pushed_match_id = 0;

        // Loading file with last max match ID
        if (fs.existsSync('last_pushed_match_id'))
        {
            last_pushed_match_id = parseInt(fs.readFileSync('last_pushed_match_id', 'utf8'));
        }

        $ = cheerio.load(body);

        var matches = [];
        var i = 0;

        // Processing each matches' div
        $('.qm_wrapper').each(function (i, elem) {

            var match = cheerio.load($(this).html());

            // Fetching match time
            var kickoff_time = '';
            var ending_time = '';

            match('.qm_time label span').each(function (i, elem) {
                var time = match('.qm_time label').html();

                if ($(this).hasClass('start')) {
                    kickoff_time = $(this).html();
                }
                else {
                    ending_time = $(this).html();
                }
            });

            // Match date
            var match_date = match('.qm_date').text().trim();

            // Pitch
            var pitch = match('.qm_pf span').attr('title').trim();

            // Free spots
            var free_spots = match('.spots').text();

            // Fee
            var price = match('.qm_price .f_11').text();

            // Link to match
            var link = match('a.qm_right_side').attr('href');

            // organizer
            var organizer = match('a.profile_avatar').attr('title');

            var match_format = match('.qm_format .f_11').text().trim();


            matches[i] = {};


            matches[i]['id']           = link.replace(/[^0-9.]/g, "");
            matches[i]['link']         = link;
            matches[i]['organizer']    = organizer;
            matches[i]['free_spots']   = free_spots;
            matches[i]['price']        = price;
            matches[i]['kickoff_time'] = kickoff_time;
            matches[i]['ending_time']  = ending_time;
            matches[i]['match_date']   = match_date;
            matches[i]['pitch']        = pitch;
            matches[i]['match_format'] = match_format;

            i += 1;
        });

        var data = {};

        data['matches']     = matches;
        data['status_code'] = response.statusCode;


        if (matches.length > 0)
        {
            var max_index = (matches.length-1);

            // Обратный обход массива, чтобы максимальный ID матча был в последней итерации
            // Reverse array loop
            for (var i = max_index; i >= 0; i--)
            {
                if ((matches[i]['id'] > last_pushed_match_id) && (ignored_pitches.indexOf(matches[i]['pitch']) < 0))
                {
                    var message = template(matches[i]);

                    var telegram_url = 'https://api.telegram.org/bot' + telegram_bot_token + '/sendMessage?chat_id=' + telegram_chat_id + '&text=' + encodeURIComponent(message);

                    request({ encoding: null, method: "GET", uri: telegram_url}, function (error, response, body) {

                    });
                    
                    last_pushed_match_id = matches[i]['id'];

                    fs.writeFileSync('last_pushed_match_id', last_pushed_match_id, 'utf8');
                }
            }
        }
    }
    else
    {
        data = {};

        if (typeof(response) != 'undefined') {
            data['status_code'] = response.statusCode;
        }

        //json(data);
    }
});
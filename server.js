var express = require('express');
var events = require('events');
var Promise = require("bluebird");
var request = require('request-promise');
var $ = require('cheerio'); // Basically jQuery for node.js 

function autoParse(body, response) {
    // FIXME: The content type string could contain additional values like the charset. 
    if (response.headers['content-type'] === 'application/json' || 
        response.headers['content-type'] === 'application/json; charset=utf-8') {
        return JSON.parse(body);
    } else if (response.headers['content-type'] === 'text/html') {
        return $.load(body);
    } else {
        return body;
    }
}

var rpap = request.defaults({ transform: autoParse }); // add autoParse function as defualt

var getFromApi = function(endpoint, args) {
    return rpap('https://api.spotify.com/v1/' + endpoint).qs(args);
};

var app = express();
app.use(express.static('public'));

app.get('/search/:name', function(req, res) {
    var searchTopTracksReq = function(artist, index, callback) {
    	// passing in index to update artist when it is returned
    	var getTopTracks = getFromApi('artists/' + artist.id + '/top-tracks', {
    		country: 'US' // must pass country code
    	});

    	getTopTracks.then(function(item) {
    		// in this API error is sent in body of response
    		// need to catch error here not in error event
    		if (item.error) {
    			callback(item.error);
    		}
    		else {
    			callback(null, index, item.tracks);
    		}
    	}).catch(function(error) {
            callback(error);
        });
    };

    var searchReq = getFromApi('search', {
        q: req.params.name,
        limit: 1,
        type: 'artist'
    });

    var artist; // declare out here so innner thens can access
    searchReq.then(function(item) {
        artist = item.artists.items[0]; // artist returned from search
    	return getFromApi('artists/' + artist.id + '/related-artists');

    }).then(function(item) {
        var completed = 0;
        var artistsCount = item.artists.length;
        var resError = null;
        var responseSent = false;

        var checkComplete = function() {
            // need to check for response here
            // because of asynchronous event it will keep calling this even
            // if the response is already sent and you will get error
            // about changing response after it has already been sent
            if (!responseSent) {
                if (resError) {
                    if (resError.status) {
                        responseSent = true;
                        res.sendStatus(resError.status);
                    }
                    else {
                        responseSent = true;
                        res.sendStatus(404);
                    }
                }

                if (completed === artistsCount) {
                    responseSent = true;
                    res.json(artist);
                }
            }
        };

        artist.related = item.artists;

        for (var i = 0; i < artist.related.length; i += 1) {
            searchTopTracksReq(artist.related[i], i, function(err, index, tracks) {
                if (err) {
                    resError = err;
                }
                else {
                    artist.related[index].tracks = tracks;
                }

                completed += 1;
                checkComplete();
            });
        }
    }).catch(function(error) {
        res.sendStatus(404);
    });
});

app.listen(process.env.PORT || 8080);
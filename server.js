var unirest = require('unirest');
var express = require('express');
var events = require('events');

var getFromApi = function(endpoint, args) {
    var emitter = new events.EventEmitter();
    unirest.get('https://api.spotify.com/v1/' + endpoint)
           .qs(args)
           .end(function(response) {
               emitter.emit('end', response.body);
            });
    return emitter;
};

var app = express();
app.use(express.static('public'));

app.get('/search/:name', function(req, res) {
    var searchTopTracksReq = function(artist, index, callback) {
    	// passing in index to update artist when it is returned
    	var getTopTracks = getFromApi('artists/' + artist.id + '/top-tracks', {
    		country: 'US' // must pass country code
    	});

    	getTopTracks.on('end', function(item) {
    		// in this API error is sent in body of response
    		// need to catch error here not in error event
    		if (item.error) {
    			callback(item.error);
    		}
    		else {
    			callback(null, index, item.tracks);
    		}
    	});

    	getTopTracks.on('error', function(err) {
    		callback(err);
    	});
    };

    var searchReq = getFromApi('search', {
        q: req.params.name,
        limit: 1,
        type: 'artist'
    });

    searchReq.on('end', function(item) {
        var artist = item.artists.items[0];

    	var relatedArtistReq = getFromApi('artists/' + artist.id + '/related-artists');

        relatedArtistReq.on('end', function(item) {
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
        });

        relatedArtistReq.on('error', function() {
			res.sendStatus(404);
        });
    });

    searchReq.on('error', function() {
        res.sendStatus(404);
    });
});

app.listen(process.env.PORT || 8080);
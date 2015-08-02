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
    var searchReq = getFromApi('search', {
        q: req.params.name,
        limit: 1,
        type: 'artist'
    });

    searchReq.on('end', function(item) {
        var artist = item.artists.items[0];

        var relatedArtistReq = getFromApi('artists/' + artist.id + '/related-artists');

        relatedArtistReq.on('end', function(item) {
        	artist.related = item.artists;
        	res.json(artist);
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
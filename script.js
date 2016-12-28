var Nightmare = require('nightmare');
var vo = require('vo');
var http = require('http');
var fs = require('fs');

require('nightmare-load-filter')(Nightmare);

var download = function(url, dest, cb) {
    var file = fs.createWriteStream(dest);
    var request = http.get(url, function(response) {
        response.pipe(file);
        file.on('finish', function() {
            file.close(cb); // close() is async, call cb after close completes.
        });
    }).on('error', function(err) { // Handle errors
        fs.unlink(dest); // Delete the file async. (But we don't check the result)
        if (cb) cb(err.message);
    });
};

vo(run)(function(err, result) {
    if (err) throw err;
});

function *run() {
    var nightmare = Nightmare({
            show: false
        }),
        memos = [];

    yield nightmare
        .filter({
            urls: [
                'http://www.sanjoseinfo.org'
            ]
        }, function(details, cb) {
            return cb({ cancel: (details.resourceType === 'image' || details.resourceType === 'stylesheet') });
        })
        .goto('http://www.sanjoseinfo.org/go/doctype/1914/47719/?offset=0')
        .wait('#documentList')

    nextExists = yield nightmare.evaluate(function() {
        return $('#documentList').next().children(':last-child:contains(next)').length > 0 ? true : false;
    }).then(function(msg) {
        return msg;
    });

    while (nextExists) {
        memos.push(yield nightmare.evaluate(function() {
            var memo = [];

            $('#documentList').children('li').each(function() {
                var that = $(this),
                    thisLink = that.find('.headline a');

                memo.push({
                    title: thisLink.text(),
                    id: thisLink.attr('href').match(/\d+.\/$/g)[0].slice(0, -1),
                    date: that.find('.postDate').text(),
                    url: 'http://www.sanjoseinfo.org' + thisLink.attr('href')
                });
            });

            $('#documentList').next().children(':last-child:contains(next)').attr('id', 'nextButton');
            return memo;
        }));

        yield nightmare
            .click('#nextButton')
            .wait('#documentList')

        nextExists = yield nightmare.evaluate(function() {
            return $('#documentList').next().children(':last-child:contains(next)').length > 0 ? true : false;
        }).then(function(msg) {
            return msg;
        });
    }

    fs.writeFile('./memos.json', JSON.stringify(memos), function(err) {
        if(err) {
            return console.log(err);
        }

        console.log("The file was saved!");
    }); 
    yield nightmare.end();
}
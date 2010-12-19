## Limestone is a Sphinx search server connector for Node.js

Usage:

    var limestone = require("./limestone").SphinxClient(),
        sys = require("sys");

    // 9312 is standard Sphinx port
    limestone.connect(9312, function(err) {
        if (err) {
            sys.puts('Connection error: ' + err);
        }
        sys.puts('Connected, sending query');
        limestone.query({'query':'test', maxmatches:1}, function(err, answer) {
            limestone.disconnect();
            sys.puts("Extended search for 'test' yielded " + answer.match_count + " results: " + JSON.stringify(answer));
        });
    });
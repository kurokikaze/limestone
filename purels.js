var limestone = require("./limestone").SphinxClient();

// 9312 is standard Sphinx port
limestone.connect(9312, function(err) {
    if (err) {
        console.log('Connection error: ' + err);
    }
    console.log('Connected, sending query');
    limestone.query({'query':'test', maxmatches:1, 'fieldweights': {'name': 80, 'body': 30}}, function(err, answer) {
        limestone.disconnect();
        console.log("Extended search for 'test' yielded " + answer.match_count + " results: " + JSON.stringify(answer));
    });
});

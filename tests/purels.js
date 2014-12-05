var limestone = require("../limestone").SphinxClient();

var testString = 'Punk';

// 9312 is standard Sphinx port
limestone.connect(9312, function(err) {
    if (err) {
        console.log('Connection error: ' + err.message);
		console.log('Maybe Sphinx is not started or uses port different than 9312');
		process.exit();
    }
    console.log('Connected, sending query');
    limestone.query({'query':testString, maxmatches:1, 'fieldweights': {'name': 80, 'desc': 30}}, function(err, answer) {
        limestone.disconnect();
        console.log("Extended search for '" + testString + "' yielded " + answer.match_count + " results: " + JSON.stringify(answer));
    });
});
var limestone = require("./limestone").SphinxClient();

// 9312 is standard Sphinx port
limestone.connect(9312, function(err) {
    if (!err) {
        limestone.query({'query':'test', indices:'*'}, function(err, answer){
            if (!err) {
                console.log("Extended search for 'test' yielded " + answer.match_count + " results: " + JSON.stringify(answer));
                limestone.disconnect();
            }
        });
    }
});

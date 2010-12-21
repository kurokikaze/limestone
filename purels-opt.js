var limestone = require("./limestone").SphinxClient(),
    sys = require("sys");

// 9312 is standard Sphinx port
limestone.connect(9312, function(err) {
    if (!err) {
        limestone.query({'query':'test', indices:'*'}, function(err, answer){
            if (!err) {
                sys.puts("Extended search for ‘test’ yielded " + answer.match_count + " results: " + JSON.stringify(answer));
                limestone.disconnect();
            }
        });
    }
});
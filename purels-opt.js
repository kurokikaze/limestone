var limestone = require("./limestone"),
    sys = require("sys");

// 9312 is standard Sphinx port
limestone.connect(9312, function() {
    limestone.query({'query':'test', maxmatches:1}, function(answer){
        sys.puts("Extended search for ‘test’ yielded " + answer.match_count + " results: " + JSON.stringify(answer));
    });
});
var limestone = require("./limestone").SphinxClient();

// 9312 is standard Sphinx port
//
var filter = {
    'type': 0, // VALUES
    'attr': 'author_id',
    'values':[1,4]
};

var filter_range = {
    'type':1, // RANGE
    'attr':'author_id',
    'min':1,
    'max':3
}

limestone.connect(9312, function(err) {
    if (!err) {
        limestone.query({'query':'document', indices:'testpipe2', filters:[filter]}, function(err, answer){
            if (!err) {
                console.log("Extended search for 'test' on authors 1 and 4 yielded " + answer.match_count + " results: " + JSON.stringify(answer));
                // limestone.disconnect();
                limestone.query({'query':'document', indices:'testpipe2', filters:[filter_range]}, function(err, answer){
                    if (!err) {
                        console.log("Extended search for 'test' on authors 1..3 yielded " + answer.match_count + " results: " + JSON.stringify(answer));
                        limestone.disconnect();
                    } else {
                        console.log('Request 2 error: ' + err);
                    }
                });
            } else {
                console.log('Request error: ' + err);
            }
        });
    } else {
        console.log('Error on search: ' + err);
    }
});

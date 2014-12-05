var limestone = require("../limestone").SphinxClient();

// 9312 is standard Sphinx port
//
var filter = {
    'type': 0, // VALUES
    'attr': 'singer_id',
    'values':[5,7]
};

var filter_range = {
    'type':1, // RANGE
    'attr':'singer_id',
    'min':6,
    'max':10
}

limestone.connect(9312, function(err) {
    if (!err) {
        limestone.query({'query':'document', indices:'test1', filters:[filter]}, function(err, answer){
            if (!err) {
                console.log("Extended search for 'test' on authors 5 and 7 yielded " + answer.match_count + " results: " + JSON.stringify(answer));
                // limestone.disconnect();
                limestone.query({'query':'document', indices:'test1', filters:[filter_range]}, function(err, answer){
                    if (!err) {
                        console.log("Extended search for 'test' on authors 6..10 yielded " + answer.match_count + " results: " + JSON.stringify(answer));
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

var sys = require("sys"),
   http = require("http"),
   limestone = require("./limestone");
http.createServer(function (request, response) {
  var startDate = (new Date()).getTime();
  response.sendHeader(200, {"Content-Type": "text/plain"});
  limestone.connect(9312, function(){
      limestone.query('test', function(answer){
        limestone.disconnect();
        var endDate = (new Date()).getTime();
        response.sendBody("Hello World\nDone in " + ((endDate-startDate) / 1000) + " seconds\n\n" + JSON.stringify(answer));
        response.finish();
      });
  });
}).listen(8000);
sys.puts("Server running at http://127.0.0.1:8000/");
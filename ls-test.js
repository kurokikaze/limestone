var sys = require("sys"),
   http = require("http"),
   limestone = require("./limestone").SphinxClient();
http.createServer(function (request, response) {

  var timed_out = false;

  setTimeout(function() {
      timed_out = true;
      response.sendHeader(500, {"Content-Type": "text/plain"});
      response.write("Request timed out\n\n");
      response.end();
  }, 2000);

  response.sendHeader(200, {"Content-Type": "text/plain"});
  var connect = limestone.connect(9312, function(err) {

      if (err) {

          response.sendHeader(500, {"Content-Type": "text/plain"});
          response.write("Connection error\n");
          response.end();

      } else {

          var startDate = (new Date()).getTime();
          var query = limestone.query('test', function(err, answer) {

            limestone.disconnect();

            if (err) {

                response.sendHeader(500, {"Content-Type": "text/plain"});
                response.write("Search error\n");
                response.end();

            } else {

                var endDate = (new Date()).getTime();

                body = "Hello World\nDone in " + ((endDate - startDate) / 1000) + " seconds\n\n" + JSON.stringify(answer) + "\n\n";
                response.sendHeader(200, {
                  "Content-Length": body.length,
                  "Content-Type": "text/plain"
                });
                response.write(body);
                response.end();
            }

          });
      }
  });
}).listen(8000);
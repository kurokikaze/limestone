var tcp = require('tcp');
var sys = require('sys');

sys.puts('Connecting to searchd...');

var port = 9312;

var server_conn = tcp.createConnection(port);
server_conn.addListener('connect', function (connection) {
    // Sending protocol version
    sys.puts('Sending version number...');
    // Here we must send 4 bytes, '00000001'
    server_conn.send(1);

    // Waiting for answer
    server_conn.addListener('receive', function(data) {
        sys.puts('Server data received: ' + data);
        if (data > 0) {
            // Here is our answer.
            sys.puts('Connection established');

        }
    });
});
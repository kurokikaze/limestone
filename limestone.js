var binary = require('./binary');
var tcp = require('tcp');
var sys = require('sys');

sys.puts('Connecting to searchd...');

var port = 9312;

var server_conn = tcp.createConnection(port);

// disable Nagle algorithm
server_conn.setNoDelay(true);

server_conn.addListener('connect', function () {
    // Sending protocol version
    sys.puts('Sending version number...');
    // Here we must send 4 bytes, '0x00000001'
    // server_conn.send(parseInt('00000000',2));
    // server_conn.send(parseInt('00000000',2));
    // server_conn.send(parseInt('00000000',2));
    // server_conn.send(parseInt('00000001',2));
    // server_conn.send(0x00000001);
    server_conn.send(binary.pack('N', 1));

    // Waiting for answer
    server_conn.addListener('receive', function(data) {
        var data_unpacked = binary.unpack('N*', data);
        sys.puts('Server data received: ' + JSON.stringify(data_unpacked));
        if (data_unpacked[""] >= 1) {
            // Here is our answer. It contains 1+
            sys.puts('Connection established');
            server_conn.close();
        }
    });
});
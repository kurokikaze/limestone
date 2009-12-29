var tcp = require('tcp');
var sys = require('sys');

sys.puts('Connecting to searchd...');

var port = 9312;

tcp.createConnection(port).addListener('connect', function (connection) {
    // Отсылаем номер версии протокола
    connection.send(1);

    // Ждём ответного сигнала - нам придёт номер версии
    connection.addListener('receive', function(data) {
        if (data > 0) {
            // Успешно получили ответ.
            sys.puts('Connection established');

        }
    });
});
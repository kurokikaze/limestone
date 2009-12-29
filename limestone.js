var binary = require('./binary');
var tcp = require('tcp');
var sys = require('sys');

var Sphinx = {};
(function(){
    var Sphinx.port = 9312;

    var Sphinx.queries = [];

    // All search modes
    var Sphinx.searchMode = {
        "ALL":0,
        "ANY":1,
        "PHRASE":2,
        "BOOLEAN":3,
        "EXTENDED":4,
        "FULLSCAN":5,
        "EXTENDED2":6    // extended engine V2 (TEMPORARY, WILL BE REMOVED)
    };

    // All ranking modes
    var Sphinx.rankingMode = {
        "PROXIMITY_BM25": 0,    ///< default mode, phrase proximity major factor and BM25 minor one
        "BM25": 1,    ///< statistical mode, BM25 ranking only (faster but worse quality)
        "NONE": 2,    ///< no ranking, all matches get a weight of 1
        "WORDCOUNT":3,    ///< simple word-count weighting, rank is a weighted sum of per-field keyword occurence counts
        "PROXIMITY":4,
        "MATCHANY" :5,
        "FIELDMASK":6
    }

    var Sphinx.sortMode = {
        "RELEVANCE": 0,
        "ATTR_DESC": 1,
        "ATTR_ASC": 2,
        "TIME_SEGMENTS": 3,
        "EXTENDED": 4,
        "EXPR": 5
    }
    var Sphinx.groupMode = {
        "DAY": 0,
        "WEEK": 1,
        "MONTH": 2,
        "YEAR": 3,
        "ATTR": 4,
        "ATTRPAIR": 5
    }

    sys.puts('Connecting to searchd...');

    var server_conn = tcp.createConnection(Sphinx.port);

    var AddQuery = function(query) {
        var req_main = binary.pack("NNNNN", 0, 20, Sphinx.searchMode.ALL, Sphinx.rankingMode.BM25, Sphinx.sortMode.RELEVANCE); // mode and limits
        var req_sortby = binary.pack("N", 0); // "sort by" is not supported yet
        var req_query = binary_pack('N', query) + query; // Watch out for Unicode string length
        var req_weights = binary.pack( "N", 0); // weights is not supported yet
        var req_index = binary.pack("N", 1) + '*'; // Watch out for string length
        var req_marker = binary.pack('N', 1); // id64 range

        var req_filters = binary.pack("N", 0); // filters is not supported yet
        var req_grouping = binary.pack("NN", Sphinx.groupMode.DAY, 0); // Basic grouping is supported

        var req_anchor = binary.pack("N", 0); // anchor is not supported yet
        var req_indexWeights = binary.pack("N", 0); // Per-index weights is not supported yet
        var req_maxQueryTime = binary.pack("N", 0); // Max query time is set to 0
        var req_fieldWeights = binary.pack("N", 0); // Per-field weights is not supported yet

        var req_comment = binary.pack("N", 0); // Comments is not supported yet
        var req_overrides = binary.pack("N", 0); // Atribute overrides is not supported yet

        var req_select = binary.pack("N", 1) + '*'; // Watch out for string length
    }

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
})();
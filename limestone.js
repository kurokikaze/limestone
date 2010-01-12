var bits = require('./bits');
var tcp = require('tcp');
var sys = require('sys');

var Sphinx = {
    'port':9312
};

(function() {
    // var Sphinx.port = 9312;

    Sphinx.queries = [];

    // All search modes
    Sphinx.searchMode = {
        "ALL":0,
        "ANY":1,
        "PHRASE":2,
        "BOOLEAN":3,
        "EXTENDED":4,
        "FULLSCAN":5,
        "EXTENDED2":6    // extended engine V2 (TEMPORARY, WILL BE REMOVED)
    };

    // All ranking modes
    Sphinx.rankingMode = {
        "PROXIMITY_BM25": 0,    ///< default mode, phrase proximity major factor and BM25 minor one
        "BM25": 1,    ///< statistical mode, BM25 ranking only (faster but worse quality)
        "NONE": 2,    ///< no ranking, all matches get a weight of 1
        "WORDCOUNT":3,    ///< simple word-count weighting, rank is a weighted sum of per-field keyword occurence counts
        "PROXIMITY":4,
        "MATCHANY" :5,
        "FIELDMASK":6
    };

    Sphinx.sortMode = {
        "RELEVANCE": 0,
        "ATTR_DESC": 1,
        "ATTR_ASC": 2,
        "TIME_SEGMENTS": 3,
        "EXTENDED": 4,
        "EXPR": 5
    };

    Sphinx.groupMode = {
        "DAY": 0,
        "WEEK": 1,
        "MONTH": 2,
        "YEAR": 3,
        "ATTR": 4,
        "ATTRPAIR": 5
    };

    // Commands
    Sphinx.command = {
        "SEARCH"  : 0,
        "EXCERPT" : 1,
        "UPDATE"  : 2,
        "KEYWORDS": 3,
        "PERSIST" : 4,
        "STATUS"  : 5,
        "QUERY"   : 6
    };

    // Current version client commands
    Sphinx.clientCommand = {
        "SEARCH": 278,
        "EXCERPT": 256,
        "UPDATE": 258,
        "KEYWORDS": 256,
        "STATUS": 256,
        "QUERY": 256
    }

    Sphinx.statusCode = {
        "OK":      0,
        "ERROR":   1,
        "RETRY":   2,
        "WARNING": 3
    }

    Sphinx.attribute = {
        "INTEGER":        1,
        "TIMESTAMP":      2,
        "ORDINAL":        3,
        "BOOL":           4,
        "FLOAT":          5,
        "BIGINT":         6,
        "MULTI":          0x40000000
    }

    sys.puts('Connecting to searchd...');

    var server_conn = tcp.createConnection(Sphinx.port);

    // disable Nagle algorithm
    server_conn.setNoDelay(true);
    server_conn.setEncoding('binary');

    server_conn.addListener('connect', function () {
        // Sending protocol version
        sys.puts('Sending version number...');
        // Here we must send 4 bytes, '0x00000001'
        server_conn.send((new bits.Encoder()).push_int32(1).toRawString(), 'binary');

        // Waiting for answer
        server_conn.addListener('receive', function(data) {
            // var data_unpacked = binary.unpack('N*', data);
            var receive_listeners = server_conn.listeners('receive');
            var i;
            for (i = 0; i < receive_listeners.length; i++) {
                server_conn.removeListener('receive', receive_listeners[i]);
            }
            var protocol_version = (new bits.Decoder(data)).shift_int32();
            var data_unpacked = {'': 1};

            var composeQuery = function(query) {
                // Header


                var request = (new bits.Encoder(0, Sphinx.clientCommand.SEARCH)).push_int32(0).push_int32(20).push_int32(Sphinx.searchMode.ALL).push_int32(Sphinx.rankingMode.BM25).push_int32(Sphinx.sortMode.RELEVANCE);

                request.push_int32(0); // "sort by" is not supported yet

                request.push_int32(query.length); // Query text length

                request.push_raw_string(query); // Query text

                request.push_int32(0); // weights is not supported yet

                request.push_int32(1).push_raw_string('*'); // Indices used

                request.push_int32(1); // id64 range marker

                request.push_int32(0).push_int32(0).push_int32(0).push_int32(0); // No limits for range

                request.push_int32(0);
                // var req_filters = binary.pack("N", 0); // filters is not supported yet
                request.push_int32(Sphinx.groupMode.DAY);
                request.push_int32(0); // Groupby length
                // var req_grouping = binary.pack("NN", Sphinx.groupMode.DAY, 0); // Basic grouping is supported

                request.push_int32(1000); // Maxmatches, default to 1000

                request.push_int32("@group desc".length); // Groupsort
                request.push_raw_string("@group desc");

                request.push_int32(0); // Cutoff
                request.push_int32(0); // Retrycount
                request.push_int32(0); // Retrydelay

                request.push_int32(0); // Group distinct

                request.push_int32(0); // anchor is not supported yet

                request.push_int32(0); // Per-index weights is not supported yet

                request.push_int32(0); // Max query time is set to 0

                request.push_int32(0); // Per-field weights is not supported yet

                request.push_int32(0); // Comments is not supported yet

                request.push_int32(0); // Atribute overrides is not supported yet

                request.push_int32(1).push_raw_string('*'); // Select-list

                server_conn.send(request.toString(), 'binary');

                sys.puts('Request sent: [' +  request.toString().length + ']');
                var x;
                for (x = 0; x < request.toString().length; x++) {
                    sys.puts(x + ':' + request.toString().charCodeAt(x).toString(16));
                }

                server_conn.addListener('receive', function(data) {
                    // Got response!
                    sys.puts('Answer received:' + data + '[' + data.length + ']');
                    // Command must match the one used in query
                    var response = getResponse(data, Sphinx.clientCommand.SEARCH);

                    var answer = parseSearchResponse(response);

                    sys.puts('Answer data:' + JSON.stringify(answer));
                });
            };

            var getResponse = function(data, search_command) {
                var output = {};
                var response = new bits.Decoder(data);
                var position = 0;
                var data_length = data.length;

                output.status = response.shift_int16();
                output.version = response.shift_int16();

                output.length = response.shift_int32();

                if (output.length != data.length - 8) {
                    sys.puts("failed to read searchd response (status=" + output.status + ", ver=" + output.version + ", len=" + output.length + ", read=" + (data.length - 8) + ")");
                }

                if (output.version < search_command) {
                    sys.puts("searchd command older than client's version, some options might not work");
                }

                if (output.status == Sphinx.statusCode.WARNING) {
                    sys.puts("WARNING: ");
                }

                return data.substring(8);
            }

            var parseSearchResponse = function (data) {
                var output = {};
                var response = new bits.Decoder(data);
                var position = 0;
                var data_length = data.length;
                var i;

                output.status = response.shift_int32();
                output.num_fields = response.shift_int32();

                output.fields = [];
                output.attributes = [];
                output.matches = [];

                // Get fields
                for (i = 0; i < output.num_fields; i++) {
                    var field = {};
                    field.length = response.shift_int32();
                    field.name = response.shift_raw_string(field.length);
                    output.fields.push(field);
                }

                output.num_attrs = response.shift_int32();

                // Get attributes
                for (i = 0; i < output.num_attrs; i++) {
                    var attribute = {};
                    attribute.length = response.shift_int32();
                    attribute.name = response.shift_raw_string(attribute.length);
                    attribute.type = response.shift_int32();
                    output.attributes.push(attribute);
                }

                output.match_count = response.shift_int32();
                output.id64 = response.shift_int32();

                // Get matches
                for (i = 0; i < output.match_count; i++) {
                    var match = {};

                    if (output.id64 == 1) {
                        // here we must fetch int64 document id
                        // and immediately throw half of it away :)
                        var id64 = response.shift_int32();
                        match.doc = response.shift_int32();

                        match.weight = response.shift_int32();
                    } else {
                        match.doc = response.shift_int32();

                        match.weight = response.shift_int32();
                    }

                    var attrvals = [];
                    match.attrs = {};

                    //
                    var attr_value;

                    for (attribute in output.attributes) {
                        // BIGINT size attributes
                        if (attribute.type == Sphinx.attribute.BIGINT) {
                            attr_value = response.shift_int32();
                            attr_value = response.shift_int32();
                            match.attrs[attribute.name] = attr_value;
                            continue;
                        }

                        // FLOAT size attributes (32 bits)
                        if (attribute.type == Sphinx.attribute.FLOAT) {
                            attr = response.shift_int32();
                            match.attrs[attribute.name] = attr_value;
                            continue;
                        }

                        // We don't need this branch right now,
                        // as it is covered by previous `if`
                        // @todo: implement MULTI attribute type
                        attr_value = response.shift_int32();
                        match.attrs[attribute.name] = attr_value;
                    }

                    output.matches.push(match);

                }

                output.total = response.shift_int32();
                output.total_found = response.shift_int32();
                output.msecs = response.shift_int32();
                output.words = response.shift_int32();

                // @todo: implement

                return output;
            }

            sys.puts('Server data received: ' + protocol_version);
            if (data_unpacked[""] >= 1) {

                // Remove listener after handshaking
                for (listener in server_conn.listeners('receive')) {
                    server_conn.removeListener('receive', listener);
                }

                server_conn.removeListener('receive');
                // Here is our answer. It contains 1+
                sys.puts('Connection established, sending query');
                sys.puts('text'.length);

                composeQuery('test');

                //server_conn.close();
            }
        });
    });
})();
var tcp = require('net');
var sys = require('sys');

exports.SphinxClient = function() {
    var self = { };

    var buffer_extras = require('./buffer_extras');

    var Sphinx = {
        port : 9312
    };

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
    };

    Sphinx.statusCode = {
        "OK":      0,
        "ERROR":   1,
        "RETRY":   2,
        "WARNING": 3
    };

    Sphinx.attribute = {
        "INTEGER":        1,
        "TIMESTAMP":      2,
        "ORDINAL":        3,
        "BOOL":           4,
        "FLOAT":          5,
        "BIGINT":         6,
        "MULTI":          1073741824 // 0x40000000
    };

    var server_conn;
    var connection_status;
    var response_output;

    // Connect to Sphinx server
    self.connect = function(port, callback) {

        server_conn = tcp.createConnection(port || Sphinx.port);
        // disable Nagle algorithm
        server_conn.setNoDelay(true);
        //server_conn.setEncoding('binary');

        response_output = null;

        //var promise = new process.Promise();

        server_conn.addListener('connect', function () {

            //sys.puts('Connected, sending protocol version... State is ' + server_conn.readyState);
            // Sending protocol version
            // sys.puts('Sending version number...');
            // Here we must send 4 bytes, '0x00000001'
            if (server_conn.readyState == 'open') {
				var version_number = Buffer.makeWriter();
				version_number.push.int32(1);
                server_conn.write(version_number.toBuffer());

                // Waiting for answer
                server_conn.on('data', function(data) {
                    /*if (response_output) {
                        sys.puts('connect: Data received from server');
                    }*/

                    // var data_unpacked = binary.unpack('N*', data);
                    var receive_listeners = server_conn.listeners('data');
                    var i, z;
                    for (i = 0; i < receive_listeners.length; i++) {
                        server_conn.removeListener('data', receive_listeners[i]);
                    }
					var protocol_version_raw = data.toReader();
                    var protocol_version = protocol_version_raw.int32();
                    var data_unpacked = {'': protocol_version};

                    //  console.log('Protocol version: ' + protocol_version);

                    if (data_unpacked[""] >= 1) {

                        // Remove listener after handshaking
                        var listeners = server_conn.listeners('data');
                        for (z = 0; z < listeners.length; z++) {
                            server_conn.removeListener('data', listeners[z]);
                        }

                        // Simple connection status indicator
                        connection_status = 1;

                        server_conn.on('data', readResponseData);

                        // Use callback
                        // promise.emitSuccess();
                        callback(null);

                    } else {
                        callback(new Error('Wrong protocol version: ' + protocol_version));
                    }

                });
                server_conn.on('error', function(exp) {
                    console.log('Error: ' + exp);
                });
            } else {
                callback(new Error('Connection is ' + server_conn.readyState + ' in OnConnect'));
            }
        });

    };

    // sys.puts('Connecting to searchd...');

    self.query = function(query_raw, callback) {
        var query;

        initResponseOutput(callback);

        var query_parameters = {
            groupmode: Sphinx.groupMode.DAY,
            groupsort: "@group desc",
            groupdistinct: "",
            indices: '*',
            groupby: '',
            maxmatches: 1000,
            selectlist: '*',
            weights: [],
            comment: ''
        };

        if (query_raw.groupmode) {
            query_parameters.groupmode = query_raw.groupmode;
        }

        if (query_raw.groupby) {
            query_parameters.groupby = query_raw.groupby;
        }

        if (query_raw.groupsort) {
            query_parameters.groupsort = query_raw.groupsort;
        }

        if (query_raw.groupdistinct) {
            query_parameters.groupdistinct = query_raw.groupdistinct;
        }

        if (query_raw.indices) {
            query_parameters.indices = query_raw.indices;
        }

        if (query_raw.maxmatches) {
            query_parameters.maxmatches = query_raw.maxmatches;
        }

        if (query_raw.selectlist) {
            query_parameters.selectlist = query_raw.selectlist;
        }

        if (query_raw.weights) {
            query_parameters.weights = query_raw.weights;
        }

        if (query_raw.comment) {
            query_parameters.comment = query_raw.comment;
        }

        if (query_raw.query) {
            query = query_raw.query;
        } else {
            query = query_raw.toString();
        }

        /* if (connection_status != 1) {
         sys.puts("You must connect to server before issuing queries");
         return false;

         }  */

		var request = Buffer.makeWriter(); 
		request.push.int16(Sphinx.command.SEARCH);
		request.push.int16(Sphinx.clientCommand.SEARCH);
		
        request.push.int32(0); // Whis will be request length
        request.push.int32(1);
		request.push.int32(0);
		request.push.int32(20);
		
		request.push.int32(Sphinx.searchMode.ALL);
		request.push.int32(Sphinx.rankingMode.BM25);
		
		request.push.int32(Sphinx.sortMode.RELEVANCE);
		
        //var request = (new bits.Encoder(Sphinx.command.SEARCH, Sphinx.clientCommand.SEARCH)).push_int32(0).push_int32(20).push_int32(Sphinx.searchMode.ALL).push_int32(Sphinx.rankingMode.BM25).push_int32(Sphinx.sortMode.RELEVANCE);

        request.push.int32(0); // "sort by" is not supported yet

        request.push.lstring(query); // Query text

        request.push.int32(query_parameters.weights.length); // weights is not supported yet
        for (var weight in query_parameters.weights) {
            request.push.int32(parseInt(weight));
        }

        request.push.lstring(query_parameters.indices); // Indices used

        request.push.int32(1); // id64 range marker

        request.push.int32(0);
        request.push.int32(0); // This is actually two 64-bit numbers
        request.push.int32(0);
        request.push.int32(0); // No limits for range

        request.push.int32(0); // filters is not supported yet

        request.push.int32(query_parameters.groupmode);
        request.push.lstring(query_parameters.groupby); // Groupby length

        request.push.int32(query_parameters.maxmatches); // Maxmatches, default to 1000

        request.push.lstring(query_parameters.groupsort); // Groupsort

        request.push.int32(0); // Cutoff
        request.push.int32(0); // Retrycount
        request.push.int32(0); // Retrydelay

        request.push.lstring(query_parameters.groupdistinct); // Group distinct

        request.push.int32(0); // anchor is not supported yet

        request.push.int32(0); // Per-index weights is not supported yet

        request.push.int32(0); // Max query time is set to 0

        request.push.int32(0); // Per-field weights is not supported yet

        request.push.lstring(query_parameters.comment); // Comments is not supported yet

        request.push.int32(0); // Atribute overrides is not supported yet

        request.push.lstring(query_parameters.selectlist); // Select-list

        var request_buf = request.toBuffer();
        var req_length = Buffer.makeWriter();
        req_length.push.int32(request_buf.length - 8);
        req_length.toBuffer().copy(request_buf, 4, 0);

        // console.log('Sending request of ' + request_buf.length + ' bytes');
        server_conn.write(request_buf);
    };

    self.disconnect = function() {
        server_conn.end();
    };

    function readResponseData(data) {
        // Got response!
        // Command must match the one used in query
        response_output.append(data);
    }

    function initResponseOutput(query_callback) {
        response_output = {
            status  : null,
            version : null,
            length  : 0,
            data    : new Buffer(0),
            parseHeader : function() {
                if (this.status === null && this.data.length >= 8) {
                    // console.log('Answer length: ' + (this.data.length));
					var decoder = this.data.toReader();
                    // var decoder = new bits.Decoder(this.data);

                    this.status  = decoder.int16();
                    this.version = decoder.int16();
                    this.length  = decoder.int32();
                    // console.log('Receiving answer with status ' + this.status + ', version ' + this.version + ' and length ' + this.length);

					this.data = this.data.slice(8, this.data.length);
                    // this.data = decoder.string(this.data.length - 8);
                }
            },
            append  : function(data) {
                //this.data.write(data.toString('utf-8'), 'utf-8');
                // sys.puts('Appending ' + data.length + ' bytes');
                var new_buffer = new Buffer(this.data.length + data.length);
                this.data.copy(new_buffer, 0, 0);
                data.copy(new_buffer, this.data.length, 0);
                this.data = new_buffer;
                // console.log('Data length after appending: ' + this.data.length);
                this.parseHeader();
                this.runCallbackIfDone();
            },
            done : function() {
                // console.log('Length: ' + this.data.length + ' / ' + this.length);
                return this.data.length >= this.length;
            },
            checkResponse : function(search_command) {
                var errmsg = '';
                if (this.length !== this.data.length) {
                    errmsg += "Failed to read searchd response (status=" + this.status + ", ver=" + this.version + ", len=" + this.length + ", read=" + this.data.length + ")";
                }

                if (this.version < search_command) {
                    errmsg += "Searchd command older than client's version, some options might not work";
                }

                if (this.status == Sphinx.statusCode.WARNING) {
                    errmsg += "Server issued WARNING: " + this.data;
                }

                if (this.status == Sphinx.statusCode.ERROR) {
                    errmsg += "Server issued ERROR: " + this.data;
                }
                return errmsg;
            },
            runCallbackIfDone : function() {
                if (this.done()) {
                    var answer;
                    var errmsg = this.checkResponse(Sphinx.clientCommand.SEARCH);
                    if (!errmsg) {
                        answer = parseSearchResponse(response_output.data);
                    }
                    query_callback(errmsg, answer);
                }
            }
        };
    }

    var parseSearchResponse = function (data) {
        var output = {};
        // var response = new bits.Decoder(data);
        var response = data.toReader();
        var i;

        output.status = response.int32();
        output.num_fields = response.int32();

        output.fields = [];
        output.attributes = [];
        output.matches = [];

        // Get fields
        for (i = 0; i < output.num_fields; i++) {
            var field = {};

            field.name = response.lstring();

            output.fields.push(field);
        }

        output.num_attrs = response.int32();

        // Get attributes
        for (i = 0; i < output.num_attrs; i++) {
            var attribute = {};

            attribute.name = response.lstring();
            attribute.type = response.int32();

            output.attributes.push(attribute);
        }

        output.match_count = response.int32();
        output.id64 = response.int32();

        // Get matches
        for (i = 0; i < output.match_count; i++) {
            var match = {};

            // Here server tells us which format for document IDs
            // it uses: int64 or int32
            if (output.id64 == 1) {
                // here we must fetch int64 document id
                // and immediately throw half of it away :)
                var id64 = response.int32();
                match.doc = response.int32();
                match.weight = response.int32();
            } else {
                // Good news: document id fits our integers size :)
                match.doc = response.int32();
                match.weight = response.int32();
            }

            match.attrs = {};

            //
            var attr_value;
            // var attribute;

            for (attribute in output.attributes) {
                // BIGINT size attributes (64 bits)
                if (attribute.type == Sphinx.attribute.BIGINT) {
                    attr_value = response.int32();
                    attr_value = response.int32();
                    match.attrs[output.attributes[attribute].name] = attr_value;
                    continue;
                }

                // FLOAT size attributes (32 bits)
                if (output.attributes[attribute].type == Sphinx.attribute.FLOAT) {
                    attr_value = response.int32();
                    match.attrs[output.attributes[attribute].name] = attr_value;
                    continue;
                }

                // We don't need this branch right now,
                // as it is covered by previous `if`
                // @todo: implement MULTI attribute type
                attr_value = response.int32();
                match.attrs[output.attributes[attribute].name] = attr_value;
            }

            output.matches.push(match);

        }

        output.total = response.int32();
        output.total_found = response.int32();
        output.msecs = response.int32();
        output.words_count = response.int32();
        output.words = [];
        for (i = 0; i <= output.words; i++) {
            output.words.push(response.lstring());
        }
        // sys.puts('Unused data:' + response.length + ' bytes');

        // @todo: implement words

        return output;
    };

    return self;
};

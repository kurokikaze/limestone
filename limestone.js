var tcp = require('net');

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
        "PROXIMITY_BM25"	: 0,    ///< default mode, phrase proximity major factor and BM25 minor one
        "BM25"				: 1,    ///< statistical mode, BM25 ranking only (faster but worse quality)
        "NONE"				: 2,    ///< no ranking, all matches get a weight of 1
        "WORDCOUNT"			: 3,    ///< simple word-count weighting, rank is a weighted sum of per-field keyword occurence counts
        "PROXIMITY"			: 4,
        "MATCHANY"			: 5,
        "FIELDMASK"			: 6,
        "SPH04"				: 7,
        "TOTAL"				: 8
    };

    Sphinx.sortMode = {
        "RELEVANCE"		: 0,
        "ATTR_DESC"		: 1,
        "ATTR_ASC"		: 2,
        "TIME_SEGMENTS"	: 3,
        "EXTENDED"		: 4,
        "EXPR"			: 5
    };

    Sphinx.groupFunc = {
        "DAY"		: 0,
        "WEEK"		: 1,
        "MONTH"		: 2,
        "YEAR"		: 3,
        "ATTR"		: 4,
        "ATTRPAIR"	: 5
    };

    // Commands
    Sphinx.command = {
        "SEARCH"  		: 0,
        "EXCERPT" 		: 1,
        "UPDATE"  		: 2,
        "KEYWORDS"		: 3,
        "PERSIST" 		: 4,
        "STATUS"  		: 5,
        "QUERY"   		: 6,
        "FLUSHATTRS"	: 7
    };

    // Current version client commands
    Sphinx.clientCommand = {
        "SEARCH"	: 0x118,
        "EXCERPT"	: 0x103,
        "UPDATE"	: 0x102,
        "KEYWORDS"	: 0x100,
        "STATUS"	: 0x100,
        "QUERY"		: 0x100,
        "FLUSHATTRS": 0x100
    };

    Sphinx.statusCode = {
        "OK":      0,
        "ERROR":   1,
        "RETRY":   2,
        "WARNING": 3
    };

    Sphinx.filterTypes = {
    	"VALUES"		: 0,
    	"RANGE"			: 1,
    	"FLOATRANGE"	: 2
    };

    Sphinx.attribute = {
        "INTEGER":        1,
        "TIMESTAMP":      2,
        "ORDINAL":        3,
        "BOOL":           4,
        "FLOAT":          5,
        "BIGINT":         6,
        "STRING":         7,
        "MULTI":          0x40000000 
    };

    self.Sphinx = Sphinx;

    var server_conn;
    var connection_status;
    var response_output;
    var conn_in_progress = 0;

    var search_commands = [];

    // Connect to Sphinx server
    self.connect = function(port, persistent, callback) {

	// arguments: port, persistent, callback. 
	var args = Array.prototype.slice.call(arguments);

	var callback = args.pop();
	var port = args.length ? args.shift(): Sphinx.port;
	var persistent = args.length ? args.shift() : false;


	// very ugly method of making sure no attempt to connection is made until all previous are done
	if(conn_in_progress == 1){
	    setTimeout(self.connect,10,port,callback);
	    return;
	}
	
        server_conn = tcp.createConnection(port);
	conn_in_progress = 1;
        // disable Nagle algorithm
        server_conn.setNoDelay(true);
        //server_conn.setEncoding('binary');

        response_output = null;

        //var promise = new process.Promise();

        server_conn.addListener('connect', function () {

            // console.log('Connected, sending protocol version... State is ' + server_conn.readyState);
            // Sending protocol version
            // console.log('Sending version number...');
            // Here we must send 4 bytes, '0x00000001'
            if (server_conn.readyState == 'open') {
		var version_number = Buffer.makeWriter();
		version_number.push.int32(1);
                // Waiting for answer
                server_conn.once('data', function(data) {
                    /*if (response_output) {
                        console.log('connect: Data received from server');
                    }*/

		    var protocol_version_raw = data.toReader();
                    var protocol_version = protocol_version_raw.int32();
                    var data_unpacked = {'': protocol_version};

                    if (data_unpacked[""] >= 1) {

                        // Simple connection status indicator
                        connection_status = 1;

			server_conn.write(version_number.toBuffer());

			if(persistent){
			    var pers_req = Buffer.makeWriter();
			    pers_req.push.int16(Sphinx.command.PERSIST);
			    pers_req.push.int16(0);
			    pers_req.push.int32(4);
			    pers_req.push.int32(1);
			    server_conn.write(pers_req.toBuffer());
			}

                        server_conn.on('data', readResponseData);

                        // Use callback
                        // promise.emitSuccess();
                        callback(null);

                    } else {
                        callback(new Error('Wrong protocol version: ' + protocol_version));
                        conn_in_progress = 0;
                        server_conn.end();
                    }

                });
                server_conn.on('error', function(exp) {
                    console.log('Error: ' + exp);
                    server_conn.end();
                    conn_in_progress = 0;
                });
            } else {
                callback(new Error('Connection is ' + server_conn.readyState + ' in OnConnect'));
                server_conn.end();
		conn_in_progress = 0;
            }
        });

    };

    // console.log('Connecting to searchd...');

    self.query = function(query_raw, callback) {
        var query = new Object();

        initResponseOutput(callback);

        // Default query parameters
        var query_parameters = {
	    offset				: 0,
	    limit				: 20,
	    mode				: Sphinx.searchMode.ALL,
	    weights				: [],
	    sort				: Sphinx.sortMode.RELEVANCE,
	    sortby				: "",
	    min_id				: 0,
	    max_id				: 0,
	    filters				: [],
	    groupby				: "",
	    groupfunc			: Sphinx.groupFunc.DAY,
	    groupsort			: "@group desc",
	    groupdistinct		: "",
	    maxmatches			: 1000,
	    cutoff				: 0,
	    retrycount			: 0,
	    retrydelay			: 0,
	    anchor				: [],
	    indexweights		: [],
	    ranker				: Sphinx.rankingMode.PROXIMITY_BM25,
	    maxquerytime		: 0,
	    fieldweights				: {},
	    overrides 			: [],
	    selectlist			: "*",
            indexes				: '*',
            comment				: '',
            query				: "",
	    error				: "", // per-reply fields (for single-query case)
	    warning				: "",
	    connerror			: false,
	    
	    reqs				: [],	// requests storage (for multi-query case)
	    mbenc				: "",
	    arrayresult			: true,
	    timeout				: 0
        };

        if (query_raw.query) {
            for (x in query_parameters) {
            	if (query_raw.hasOwnProperty(x)) {
                    query[x] = query_raw[x];            		
            	} else {
                    query[x] = query_parameters[x];
            	}
            }
        } else {
            query = query_raw.toString();
        }

        /* if (connection_status != 1) {
         console.log("You must connect to server before issuing queries");
         return false;

         }  */

	var request = Buffer.makeWriter(); 
    request.push.int16(Sphinx.command.SEARCH);
	request.push.int16(Sphinx.clientCommand.SEARCH);
		
        request.push.int32(0); // This will be request length
        request.push.int32(0);
        request.push.int32(1);
        
	request.push.int32(query.offset);
		
	request.push.int32(query.limit);

	request.push.int32(query.mode);
	request.push.int32(query.ranker);
	
	request.push.int32(query.sort);
		
        request.push.lstring(query.sortby); 
        request.push.lstring(query.query); // Query text
        request.push.int32(query.weights.length); 
        for (var weight in query.weights) {
            request.push.int32(parseInt(weight));
        }

        request.push.lstring(query.indexes); // Indexes used JEZ

        request.push.int32(1); // id64 range marker

        //request.push.int32(0);
        request.push.int64(0, query.min_id); // This is actually supposed to be two 64-bit numbers
        //request.push.int32(0);				//  However, there is a caveat about using 64-bit ids
        request.push.int64(0, query.max_id); 

        //console.log('Found ' + query.filters.length + ' filters');
        request.push.int32(query.filters.length); 
        for (var filter_id in query.filters) {
            var filter = query.filters[filter_id];
            //console.log('Found filter of type ' + filter.type)
            if (!filter.attr) {
                filter.attr = "";
            }
            if (!filter.exclude) {
                filter.exclude = 0;
            }
            //request.push.int32(filter.attr.length);//WTF? length is included in lstring
            request.push.lstring(filter.attr);
            request.push.int32(filter.type);
            switch (filter.type) {
            	case Sphinx.filterTypes.VALUES:
            		request.push.int32(filter.values.length); // Count of values
            		for (var value_id in filter.values) {
                		//request.push.int32(0);		// should be a 64-bit number
                		request.push.int64(0, filter.values[value_id]);
            		}
            		break;
            	case Sphinx.filterTypes.RANGE:
            		//request.push.int32(0);		// should be a 64-bit number
            		request.push.int64(0, filter.min);
            		//request.push.int32(0);		// should be a 64-bit number
            		request.push.int64(0, filter.max);
            		break;
            	case Sphinx.filterTypes.FLOATRANGE:
            		request.push.float(filter.min);
            		request.push.float(filter.max);
            		break;
            }
            request.push.int32(filter.exclude);
        }
        
        request.push.int32(query_parameters.groupfunc);
        request.push.lstring(query_parameters.groupby); // Groupby length

        request.push.int32(query_parameters.maxmatches); // Maxmatches, default to 1000

        request.push.lstring(query_parameters.groupsort); // Groupsort

        request.push.int32(query_parameters.cutoff); // Cutoff
        request.push.int32(query_parameters.retrycount); // Retrycount
        request.push.int32(query_parameters.retrydelay); // Retrydelay

      request.push.lstring(query_parameters.groupdistinct); // Group distinct

        if (query_parameters.anchor.length == 0) {
            request.push.int32(0); // no anchor given
        } else {
            request.push.int32(1); // anchor point in radians
            request.push.lstring(query_parameters.anchor["attrlat"]); // Group distinct
            request.push.lstring(query_parameters.anchor["attrlong"]); // Group distinct
    		request.push.float(query_parameters.anchor["lat"]);
    		request.push.float(query_parameters.anchor["long"]);
        }

        request.push.int32(query_parameters.indexweights.length);
        for (var i in query_parameters.indexweights) {
            request.push.int32(i);
            request.push.int32(query_parameters.indexweights[i]);
        }

        request.push.int32(query_parameters.maxquerytime); 
	    // per-field weights (preferred method)
        request.push.int32(Object.keys(query.fieldweights).length);
        for (var field_name in query.fieldweights) {
	    request.push.lstring(field_name);
            request.push.int32(query.fieldweights[field_name]);
        }

        request.push.lstring(query_parameters.comment); 

        request.push.int32(query_parameters.overrides.length);
        for (var i in query_parameters.overrides) {
            request.push.lstring(query_parameters.overrides[i].attr); 
            request.push.int32(query_parameters.overrides[i].type);
            request.push.int32(query_parameters.overrides[i].values.length);
            for (var id in query_parameters.overrides[i].values) {
                request.push.int64(id);
                switch (query_parameters.overrides[i].type) {
	                case Sphinx.attribute.FLOAT:
	                    request.push.float(query_parameters.overrides[i].values[id]);
	                    break;
	                case Sphinx.attribute.BIGINT:
	                    request.push.int64(query_parameters.overrides[i].values[id]);
	                    break;
	                default:
	                    request.push.int32(query_parameters.overrides[i].values[id]);
	                    break;
                }
            }
        }

      request.push.lstring(query_parameters.selectlist); // Select-list

      var request_buf = request.toBuffer();
      var req_length = Buffer.makeWriter();
      req_length.push.int32(request_buf.length - 8);
      req_length.toBuffer().copy(request_buf, 4, 0);

      //console.log('Sending search request of ' + request_buf.length + ' bytes');

      server_conn.write(request_buf);
      // we also add the command to the search_commands queue
      search_commands.push(Sphinx.clientCommand.SEARCH);
    };

    self.build_excerpts = function(docs, index, words, passage_opts_raw, callback){
	var passage_opts = new Object();

	initResponseOutput(callback);

	var passage_parameters = {
	    before_match            : '<b>',
	    after_match             : '</b>',
	    chunk_separator         : ' ... ',
	    html_strip_mode         : 'index',
	    limit                   : 256,
	    limit_passages          : 0,
	    limit_words             : 0,
	    around                  : 5,
	    start_passage_id        : 1,
	    passage_boundary        : 'none',
	}

	for (x in passage_parameters) {
	    if (passage_opts_raw.hasOwnProperty(x)) {
		passage_opts[x] = passage_opts_raw[x];
	    } else {
		passage_opts[x] = passage_parameters[x];
	    }
	}

	var flags = 1;
	var flag_properties = {
	    'exact_phrase'    : 2,
	    'single_passage'  : 4,
	    'use_boundaries'  : 8,
	    'weight_order'    : 16,
	    'query_mode'      : 32,
	    'force_all_words' : 64,
	    'load_files'      : 128,
	    'allow_empty'     : 256,
	    'emit_zones'      : 256
	}
	
	for (x in flag_properties) {
	    if (passage_opts_raw.hasOwnProperty(x)) {
		flags |= flag_properties[x];
	    }
	}

	var request = Buffer.makeWriter();

	// request 'header'
	request.push.int16(Sphinx.command.EXCERPT);
	request.push.int16(Sphinx.clientCommand.EXCERPT);
	request.push.int32(0); // This will be request length
	
	// request 'body' (flags, options, docs)

	request.push.int32(0);

	request.push.int32(flags);

	request.push.lstring(index);

	request.push.lstring(words);
	
	// options
	request.push.lstring(passage_opts.before_match);
	request.push.lstring(passage_opts.after_match);
	request.push.lstring(passage_opts.chunk_separator);
	request.push.int32(passage_opts.limit);
	request.push.int32(passage_opts.around);
	request.push.int32(passage_opts.limit_passages);
	request.push.int32(passage_opts.limit_words);
	request.push.int32(passage_opts.start_passage_id);
	request.push.lstring(passage_opts.html_strip_mode);
	request.push.lstring(passage_opts.passage_boundary);

	// docs
	request.push.int32(docs.length);
	for (var doc in docs) {
	    request.push.lstring(docs[doc]);
	}

	var request_buf = request.toBuffer();
	var req_length = Buffer.makeWriter();
	req_length.push.int32(request_buf.length - 8);
	req_length.toBuffer().copy(request_buf,4,0);

	//console.log('Sending build excerpt request of ' + request_buf.length + 'bytes');
	
	server_conn.write(request_buf);
	// we also add the command to the search_commands queue
	search_commands.push(Sphinx.clientCommand.EXCERPT);
    }; // build_excerpts

    self.disconnect = function() {
	conn_in_progress = 0;
        server_conn.end();
    };

    function readResponseData(data) {
        // Got response!
        // Command must match the one used in query
        response_output.append(data);
	response_output.runCallbackIfDone(search_commands.shift());
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
                // console.log('Appending ' + data.length + ' bytes');
                var new_buffer = new Buffer(this.data.length + data.length);
                this.data.copy(new_buffer, 0, 0);
                data.copy(new_buffer, this.data.length, 0);
                this.data = new_buffer;
                // console.log('Data length after appending: ' + this.data.length);
                this.parseHeader();
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
            runCallbackIfDone : function(search_command) {
                if (this.done()) {
                    var answer;
                    var errmsg = this.checkResponse(search_command);
                    if (!errmsg) {
                        answer = parseResponse(response_output.data, search_command);
                    }
                    query_callback(errmsg, answer);
                }
            }
        };
    }

    var parseResponse = function (data, search_command) {
	if (search_command == Sphinx.clientCommand.SEARCH) {
	    return parseSearchResponse(data);
	} else if (search_command == Sphinx.clientCommand.EXCERPT) {
	    return parseExcerptResponse(data);
	}
    }

    var parseSearchResponse = function (data) {
        var output = {};
        // var response = new bits.Decoder(data);
        var response = data.toReader();
        var i;
        output.status = response.int32();
	if (output.status != 0) {
		return(response.lstring());
	}
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
                // get the 64-bit result, but only use the lower half for now
                var id64 = response.int64();
                match.doc = id64[1];
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
                if (output.attributes[attribute].type == Sphinx.attribute.BIGINT) {
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

                // STRING attributes
                if (output.attributes[attribute].type == Sphinx.attribute.STRING) {
                    attr_value = response.lstring();
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
        output.words = new Object();
        for (i = 0; i < output.words_count; i++) {
            var word = response.lstring();
            output.words[word] = new Object();
            output.words[word]["docs"] = response.int32();
            output.words[word]["hits"] = response.int32();
        }
        
        return output;
    };

    var parseExcerptResponse = function (data) {
	var output = {'docs':[]};
	var response = data.toReader();
	while(!response.empty()) {
	    output.docs.push(response.lstring());
	}
	return output;
    };

    return self;
};

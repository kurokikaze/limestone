## Limestone is a Sphinx search server connector for Node.js

Usage:

    var limestone = require("./limestone").SphinxClient(),

    limestone.connect(9312, // port. 9312 is standard Sphinx port. also 'host:port' allowed
		      function(err) { // callback
			  if (err) {
			      console.log('Connection error: ' + err.message);
				  process.exit();
			  }
			  console.log('Connected, sending query');
			  limestone.query(
			      {'query':'test', maxmatches:1}, 
			      function(err, answer) {
				  limestone.disconnect();
				  console.log("Extended search for 'test' yielded " + 
					   answer.match_count + " results: " + 
					   JSON.stringify(answer));
			      });
		      });

To Use Build_Excerpts:

    limestone.connect(9312,  // port
		      function(err) { //callback
			  if (err) {
			      console.log('Connection error: ' + err);
			  }
			  console.log('Connected Build Excerpts');
			  limestone.build_excerpts(
			      ['this is my teste text to be highlighted', 
			       'this is another test text to be highlighted'], // docs
			      'questions_1',
			      'test text',
			      {},
			      function(err, answer) {
				  limestone.disconnect();
				  console.log(JSON.stringify(answer));
			      }
			  );
		      });

Bonus: persistent connection:
You can ask sphinx to open a persistent connection. You can then make several request through the same connection

    limestone.connect(9312, // port
		      true, // persistent (optional)
		      function(err) { // callback
    			  if (err){
			      console.log('Connection error: ' + err);
			  }
			  console.log('Connected Search'); 
			  console.log('sending query');  
			  limestone.query(
			      {'query':'test', // query obj with sphinx opts
			       maxmatches:1,
			       indexes:'questions_1,products_3'},
			      function(err, answer){ // callback
				  console.log('Extended search yielded ' + 
					   answer.match_count + " results\n" +
					   JSON.stringify(answer));
		
				  limestone.build_excerpts(
				      ['this is my teste text to be highlighted', 
				       'this is another test text to be highlighted'], // docs
				      'questions_1', // index
				      'test text', // words
				      {},
				      function(err, answer){
					  limestone.disconnect();
					  console.log(JSON.stringify(answer));
				      }
				  );
				  
			      }
			  );
		      });

Limestone is queueing now:
You can safely call limestone.query or limestone.build_excerpts methods outside the scope of the callback functions, provided the connection is made persistent. Limestone will enqueue the sphinx commands and run them sequentially.

This works:

    limestone.connect(9312, // port. 9312 is standard Sphinx port
		      function(err) { // callback
		          ...
			  limestone.query(
			      {'query':'test', maxmatches:1}, 
			      function(err, answer) {
			          ....
			      });
		      });

    limestone.query({'second query':'test'}, function(err, answer){..}); // won't crash with previous

const limestone = require('../limestone').SphinxClient();

const testString = 'Punk';

// 9312 is standard Sphinx port
limestone.connect(9312, true, (connErr) => {
  if (connErr) {
    console.log(`Connection error: ${connErr.message}`);
    console.log('Maybe Sphinx is not started or uses port different than 9312');
    process.exit();
  }

  const query = (callback) => {
    limestone.query({
      query: 'Punk',
      maxmatches: 1,
      fieldweights: {
        name: 80,
        desc: 30,
      },
    }, callback);
  };

  query((firstErr, firstAnswer) => {
    console.log(`First search for ${testString} yielded ${firstAnswer.match_count} results.`);
    query((secondErr, secondAnswer) => {
      console.log(`Second search for ${testString} yielded ${secondAnswer.match_count} results.`);
      limestone.disconnect();
    });
  });
});
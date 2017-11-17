var SphinxClient = require('../limestone').SphinxClient

var defaultQueryObject = {
	offset				: 0,
	limit				: 20,
	mode				: 0, // Sphinx.searchMode.ALL
	weights				: [],
	sort				: 0, // Sphinx.sortMode.RELEVANCE
	sortby				: "",
	min_id				: 0,
	max_id				: 0,
	filters				: [],
	groupby				: "",
	groupfunc			: 0, // Sphinx.groupFunc.DAY
	groupsort			: "@group desc",
	groupdistinct		: "",
	maxmatches			: 1000,
	cutoff				: 0,
	retrycount			: 0,
	retrydelay			: 0,
	anchor				: [],
	indexweights		: [],
	ranker				: 0, // Sphinx.rankingMode.PROXIMITY_BM25
	maxquerytime		: 0,
	fieldweights		: {},
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

describe('Query object bulder', function () {
	it('String query', function () {
		let testQuery = "Test query";
		let client = new SphinxClient();
		let queryObj = client.makeQueryObject(testQuery);
		let queryBuffer = client.makeRequestBuffer(queryObj);
		let exampleObj = Object.assign({}, defaultQueryObject);
		
		exampleObj.query = testQuery;
		console.log('Object', queryBuffer.values());
		expect(queryObj).toEqual(exampleObj, "Default object with query field");
	});
	
});

describe('Request buffer bulder', function () {
	it('String query', function () {
		let testQuery = "Test query";
		let client = new SphinxClient();
		
		let testQueryObj = Object.assign({}, defaultQueryObject);
		
		testQueryObj.query = testQuery;
		
		let requestBuffer = client.makeRequestBuffer(testQueryObj).toString('hex');
		let exampleBuffer = "000001180000009700000000000000010000000000000014000000000000000000000000000000000000000a5465737420717565727900000000000000012a0000000100000000000000000000000000000000000000000000000000000000000003e80000000b4067726f7570206465736300000000000000000000000000000000000000000000000000000000000000000000000000000000000000012a";
		
		expect(requestBuffer).toEqual(exampleBuffer, "Default buffer with query field");
	});
	
});

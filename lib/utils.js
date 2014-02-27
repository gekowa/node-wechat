var getTimestamp
	, containsCaseInsensitive

;

getTimestamp = function () {
	var now = new Date(),
		begin = new Date("1970/1/1");

	return now - begin;
};


containsCaseInsensitive = function (str1, str2) {
	return str1.toLowerCase().indexOf(str2.toLowerCase()) >= 0;
};

module.exports = {
	getTimestamp: getTimestamp,
	containsCaseInsensitive: containsCaseInsensitive
};

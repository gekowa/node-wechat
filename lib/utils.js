var getTimestamp

;

getTimestamp = function () {
	var now = new Date(),
		begin = new Date("1970/1/1");

	return now - begin;
};

module.exports.getTimestamp = getTimestamp;

var WeChatMP = require("./proto")

	, _ = require("underscore")
	, createServer

;

createServer = function (token, appId, appSecret) {
	var server = {},
		wcmp = new WeChatMP(token, appId, appSecret);

	_.extend(server, wcmp);

	return server;
};

module.exports = exports = createServer;
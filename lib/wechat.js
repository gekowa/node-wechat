var WeChatMP

	, http = require("http")
	, url = require("url")
	, crypto = require("crypto")
	, qs = require("querystring")
	, nodeUtil = require("util")

	, xml2js = require("xml2js")

	, utils = require("./utils")
	, messaging = require("./message")

	// private functions
	, _checkRequest
	, _invokeCallbackSafe

	, _handlePostRequest
	, _replySubscribe
	, _replyUnsubscribe
	, _replyTextMessage

;

/**
 * check if the request is from weixin.com
 * @param  {object} url a object of url
 * @param  {string} token  the token set when apply for developer
 * @return {boolean/string}        if "echostr" is in the url, return echostr if the
 * signature matches, or return if signature matches
 */
_checkRequest = function (search, token) {
	var parsed = qs.parse((search || "").replace(/^\?/, "")),
		// weixin parameters
		signature = parsed["signature"],
		timestamp = parsed["timestamp"],
		nonce = parsed["nonce"],
		echostr = parsed["echostr"],
		parametersArray = [token, timestamp, nonce],
		concated,
		sha1;

	parametersArray.sort();

	concated = parametersArray.join('');

	sha1 = crypto.createHash("sha1").update(concated).digest("hex");

	if (echostr) {
		// testing
		if (sha1 === signature) {
			return echostr;
		} else {
			return "";
		}
	} else {
		return sha1 === signature;
	}
};

/**
 * checks if callback is defined and is a function, if yes, call with arguments
 * @param  {Function} callback the callback function to call
 */
_invokeCallbackSafe = function (callback) {
	if (callback && typeof callback === "function") {
		callback.apply(undefined, Array.prototype.slice.call(arguments, 1));
	}
};

/**
 * handle post requests from weixin server, this method fully take charge of handling request and
 * make proper response by calling other methods.
 * @param  {object} req instance of HttpRequest
 * @param  {res} res instance of HttpResponse
 */
_handlePostRequest = function (req, res) {
	var postData = "",
		self = this;

	req.on("data", function(chunk) {
		postData += chunk;
	});

	req.on("end", function() {
		// parse request xml to see if this is weixin request
		var messageXml = postData;

		xml2js.parseString(messageXml, function (error, result) {
			var message = messaging.sanitizeMessage(result.xml);
			console.dir(message);

			switch(message.MsgType) {
				case "text":
					_replyTextMessage(self, message, function (replyMessageXml) {
						res.end(replyMessageXml);
					});
				break;
				case "event":
					if (message.Event === "subscribe") {
						_replySubscribe.call(self, message, function (replyMessageXml) {
							res.end(replyMessageXml);
						});
					} else if (message.Event === "unsubscribe") {
						_replyUnsubscribe.call(self, message, function (replyMessageXml) {
							res.end(replyMessageXml);
						});
					}

			}
		});
	});
};

/**
 * Reply proper message when user subscribe
 * @param  {object}   message  the event message object
 * @param  {Function} callback callback function when message is find
 */
_replySubscribe = function (message, callback) {
	var lastCallback, replyMessageXml;
	if (this.subscribeCallbacks.length > 0) {
		lastCallback = this.subscribeCallbacks[this.subscribeCallbacks.length - 1];	//last
	}

	if (lastCallback) {
		if (typeof lastCallback === "string") {
			replyMessageXml = messaging.createTextMessageXml(message, lastCallback);
			return _invokeCallbackSafe(callback, replyMessageXml);
		} else if (typeof lastCallback === "function") {
			// TODO: Implement, not supported right now
			return void(0);
		}
	} else {
		// reply empty string
		return _invokeCallbackSafe(callback, "");
	}
};


_replyUnsubscribe = function (message, callback) {
	// do nothing
	return false && void(message) && void(callback);
};

/**
 * Handles text messages, reply proper message
  */
_replyTextMessage = function (message, callback) {
	var messageContent = message.Content,
		matchRule,
		i, j, rule, innerPattern, replyMessageCallback,
		replyMessageXml;

	// utils.log("[replyTextMessage] messageContent: " + messageContent);

	// this is callback function for rules to call
	replyMessageCallback = function () {
		var messageType, replyContent;

		// only 1 argument
		if (arguments.length === 1) {
			messageType = "text";
			replyContent = arguments[0];

		} else if (arguments.length === 2) {
			messageType = arguments[0];
			replyContent = arguments[1];
		}

		// utils.log("[replyTextMessage] messageType: " + messageType + "| replyContent: " + replyContent);

		if (!messageType) {
			nodeUtil.error("[replyTextMessage] Error: invalid arguments.");
			// reply empty string, end up everything
			return _invokeCallbackSafe(callback, "");
		}

		// prepare message xml
		switch (messageType) {
			case "text":
				replyMessageXml = messaging.createTextMessageXml(message, replyContent);
				break;
			case "news":
				replyMessageXml = messaging.createNewsMessageXml(message, replyContent /* articles */);
				// utils.log(replyMessageXml);
				break;
		}

		return _invokeCallbackSafe(callback, replyMessageXml);
	};

	for (i = 0; i < this.textRules.length; i++) {
		rule = this.textRules[i];
		matchRule = false;

		if (nodeUtil.isRegExp(rule.pattern)) {
			matchRule = rule.pattern.test(messageContent);
		} else if (typeof rule.pattern === "string") {
			matchRule =
				(messageContent.indexOf(rule.pattern) >= 0 || messageContent === rule.pattern);
		} else if (nodeUtil.isArray(rule.pattern)) {
			// utils.log("[replyTextMessage] Pattern is an Array.");
			for (j = 0; j < rule.pattern.length; j++) {
				innerPattern = rule.pattern[j];
				if (nodeUtil.isRegExp(innerPattern)) {
					// utils.log("[replyTextMessage] RegExp in Array: " + innerPattern);
					matchRule = innerPattern.test(messageContent);
				} else if (typeof innerPattern === "string") {
					// utils.log("[replyTextMessage] String in Array: " + innerPattern);
					matchRule =
						(messageContent.indexOf(innerPattern) >= 0 || messageContent === innerPattern);
				}

				if (matchRule) {
					// utils.log("[replyTextMessage] Found match in Array.");
					break;
				}
			}
		}

		if (matchRule) {
			console.dir(rule);
			// utils.log("[replyTextMessage] Found a match rule.");
			if (typeof rule.callback === "function") {
				// callback
				// utils.log("[replyTextMessage] Replying with callback function");
				return rule.callback(messageContent, replyMessageCallback);

			} else if (typeof rule.callback === "string") {

				// utils.log("[replyTextMessage] Replying with string: " + rule.callback);
				return replyMessageCallback("text", rule.callback);
			}
			break;
		}
	}

	// reply empty string, end up everything
	return replyMessageCallback("text", "");
};


WeChatMP = function (appId, appSecret, token) {
	this.appId = appId;
	this.appSecret = appSecret;
	this.token = token;

	this.textRules = [];
	this.subscribeCallbacks = [];
	this.unsubscribeCallbacks = [];
};

WeChatMP.prototype.subscribe = function (callback) {
	this.subscribeCallbacks.push(callback);
};

WeChatMP.prototype.unsubscribe = function (callback) {
	this.unsubscribeCallbacks.push(callback);
};

/**
 * create a rule that replies text messages
 */
WeChatMP.prototype.text = function (pattern, callback) {
	this.textRules.push({
		pattern: pattern,
		callback: callback
	});
};

/**
 * shortcut of creating a article entry for news item
 */
WeChatMP.prototype.article = function (title, description, picUrl, url) {
	return messaging.createNewsArticleItem(title, description, picUrl, url);
};

WeChatMP.prototype.listen = function (port) {
	var self = this;

	this.httpServer = http.createServer(function (req, res) {
		// if http method is post?
		var method = req.method,
			urlSearch;

		// utils.log("[serverOnRequest] url: " + req.url);

		urlSearch = url.parse(req.url).search;

		// utils.log("[serverOnRequest] " + urlSearch);

		if (method === "GET") {
			// this should be a test request
			res.end(_checkRequest(urlSearch, self.token));

		} else if (method === "POST") {

			if (_checkRequest(urlSearch, self.token)) {
				// utils.log("[serverOnRequest] handling post request...");
				_handlePostRequest.call(self, req, res);
			} else {
				// utils.log("[serverOnRequest] request check failed.");
				res.end();
			}

		} else {
			res.writeHead(405, {"Content-Type": "text/plain"});
			res.write(http.STATUS_CODES[405]);
			res.end();
		}
	}).listen(port);

	console.log("Http server started on port " + port);
};

module.exports = WeChatMP;
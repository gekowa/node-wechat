var utils = require("./utils")
	, nodeUtil = require("util")

	// constants
	, TEXT_MESSAGE_TEMPLATE = "<xml><ToUserName><![CDATA[%s]]></ToUserName><FromUserName><![CDATA[%s]]></FromUserName><CreateTime>%s</CreateTime><MsgType><![CDATA[text]]></MsgType><Content><![CDATA[%s]]></Content></xml>"
	, NEWS_MESSAGE_TEMPLATE = "<xml><ToUserName><![CDATA[%s]]></ToUserName><FromUserName><![CDATA[%s]]></FromUserName><CreateTime>%s</CreateTime><MsgType><![CDATA[news]]></MsgType><ArticleCount>%s</ArticleCount><Articles>%s</Articles></xml>"
	, NEWS_ITEM_TEMPLATE = "<item><Title><![CDATA[%s]]></Title><Description><![CDATA[%s]]></Description><PicUrl><![CDATA[%s]]></PicUrl><Url><![CDATA[%s]]></Url></item>"

	// functions
	, sanitizeMessage
	, createTextMessageXml
	, createNewsMessageXml
	, createNewsArticleItem;

/**
 * trim the message object converted from XML by xml2js
 */
sanitizeMessage = function (message) {
	var k, sanitized = {};
	for (k in message) {
		if (nodeUtil.isArray(message[k])) {
			if (message[k].length === 1) {
				sanitized[k] = message[k][0];
			}
		}
	}

	return sanitized;
};

createTextMessageXml = function (incomingMessage, replyContent) {
	var messageXml = nodeUtil.format(TEXT_MESSAGE_TEMPLATE,
		incomingMessage.FromUserName,
		incomingMessage.ToUserName,
		utils.getTimestamp(),
		replyContent);

	return messageXml;
};

createNewsMessageXml = function (incomingMessage, articles) {
	// first build articles xml
	var messageXml, articlesXml = "", article, i;
	for (i = 0; i < articles.length; i++) {
		article = articles[i];
		articlesXml += nodeUtil.format(NEWS_ITEM_TEMPLATE,
			article.title, article.description, article.picUrl, article.url);
	}

	messageXml = nodeUtil.format(NEWS_MESSAGE_TEMPLATE,
		incomingMessage.FromUserName,
		incomingMessage.ToUserName,
		utils.getTimestamp(),
		articles.length,
		articlesXml);

	return messageXml;
};

createNewsArticleItem = function (title, description, picUrl, url) {
	return {
		title: title,
		description: description,
		picUrl: picUrl,
		url: url
	};
};

module.exports = {
	sanitizeMessage: sanitizeMessage,
	createTextMessageXml: createTextMessageXml,
	createNewsArticleItem: createNewsArticleItem,
	createNewsMessageXml: createNewsMessageXml
};
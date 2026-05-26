// CloudFront Function: cdn-csp-viewer-response
// Runtime: cloudfront-js-2.0, Event: viewer-response
// Constructs Content-Security-Policy header dynamically.
// ALLOWLIST is injected at deploy time by deploy-csp-function.sh.

// __ALLOWLIST_INJECT__
var ALLOWLIST = {};

function handler(event) {
	var response = event.response;
	var headers = response.headers;

	var connectSrc = "'self' " + (ALLOWLIST["connect-src"] || []).join(" ");
	var mediaSrc = "'self' " + (ALLOWLIST["media-src"] || []).join(" ");
	var imgSrc = "'self' data: " + (ALLOWLIST["img-src"] || []).join(" ");
	var frameSrc = (ALLOWLIST["frame-src"] || []).join(" ");
	var scriptSrc =
		"'self' 'unsafe-eval' blob: " +
		(ALLOWLIST["script-src"] || []).join(" ") +
		" https://*.token.awswaf.com";
	var scriptSrcElem =
		"'self' 'unsafe-inline' " +
		(ALLOWLIST["script-src"] || []).join(" ") +
		" https://*.token.awswaf.com https://embed.twitch.tv";
	var styleSrc =
		"'self' 'unsafe-inline' " + (ALLOWLIST["style-src"] || []).join(" ");
	var fontSrc = "'self' data: " + (ALLOWLIST["font-src"] || []).join(" ");

	var csp =
		"default-src 'self'; " +
		"script-src " +
		scriptSrc +
		"; " +
		"script-src-elem " +
		scriptSrcElem +
		"; " +
		"style-src " +
		styleSrc +
		"; " +
		"connect-src " +
		connectSrc +
		"; " +
		"font-src " +
		fontSrc +
		"; " +
		"img-src " +
		imgSrc +
		"; " +
		"object-src 'none'; " +
		"frame-ancestors 'none'; " +
		"frame-src " +
		frameSrc +
		"; " +
		"media-src " +
		mediaSrc +
		"; " +
		"worker-src 'self' blob: https://cdn.babylonjs.com";

	headers["content-security-policy"] = { value: csp };
	return response;
}

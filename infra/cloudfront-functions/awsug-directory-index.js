// CloudFront Function: cdn-awsug-directory-index
// Runtime: cloudfront-js-2.0, Event: viewer-request
//
// Appends /index.html to directory-style requests (URIs ending in /)
// so that S3 resolves the correct MPA entry point. Without this,
// requesting /admin-rsvps/ hits a nonexistent S3 key and CloudFront
// returns the custom error page (root index.html).
//
// This is the same mechanism S3 Website Hosting provides natively,
// but since the bucket is accessed via OAC (REST API origin, not
// website endpoint), directory-index resolution must happen at the
// CloudFront layer.

function handler(event) {
	var request = event.request;
	var uri = request.uri;

	// If URI ends with / append index.html
	if (uri.endsWith("/")) {
		request.uri = uri + "index.html";
	}
	// If URI has no file extension and does not end with /, treat as
	// directory — append /index.html (handles /admin-rsvps without slash)
	else if (!uri.includes(".") && uri !== "/") {
		request.uri = uri + "/index.html";
	}

	return request;
}

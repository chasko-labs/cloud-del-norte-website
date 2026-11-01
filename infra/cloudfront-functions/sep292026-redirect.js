// CloudFront Function: sep292026-redirect
// Runtime: cloudfront-js-2.0, Event: viewer-request
// Vanity redirects for meet.clouddelnorte.org -> Google Meet rooms.
// Mirror of the LIVE function code; deploy via update-function + publish-function.

// biome-ignore lint/correctness/noUnusedVariables: CloudFront invokes handler() by name at the edge
function handler(event) {
	var req = event.request;
	var uri = req.uri;
	// Vanity paths for meetups -> Google Meet rooms (302, no query forwarded).
	var MEET_URL = "https://meet.google.com/qst-czph-egy";
	var OCT31_URL = "https://meet.google.com/xrk-gbjv-gfh";
	var target = null;
	if (
		uri === "/sep292026" ||
		uri === "/sep292026/" ||
		uri === "/seguraws-nov19" ||
		uri === "/seguraws-nov19/"
	) {
		target = MEET_URL;
	} else if (uri === "/oct312026" || uri === "/oct312026/") {
		target = OCT31_URL;
	}
	if (target) {
		return {
			statusCode: 302,
			statusDescription: "Found",
			headers: {
				location: { value: target },
				"cache-control": { value: "public, max-age=300" },
			},
		};
	}
	// Everything else goes to the meetings portal (mirrors the old ALB root_redirect).
	return {
		statusCode: 302,
		statusDescription: "Found",
		headers: {
			location: { value: "https://clouddelnorte.org/meetings/" },
			"cache-control": { value: "public, max-age=300" },
		},
	};
}

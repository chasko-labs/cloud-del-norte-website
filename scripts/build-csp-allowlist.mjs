#!/usr/bin/env node
/**
 * build-csp-allowlist.mjs
 * Parses src/lib/streams.ts to extract all stream/podcast hostnames (with ports)
 * and emits infra/cloudfront-functions/csp-allowlist.json grouped by CSP directive.
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const STREAMS_PATH = resolve(ROOT, "src/lib/streams.ts");
const OUT_DIR = resolve(ROOT, "infra/cloudfront-functions");
const OUT_PATH = resolve(OUT_DIR, "csp-allowlist.json");

const src = readFileSync(STREAMS_PATH, "utf-8");

// Extract all https:// URLs from the file
const urlRegex = /https?:\/\/[^\s"'`,)}\]]+/g;
const allUrls = [...src.matchAll(urlRegex)].map((m) => m[0]);

function hostPort(urlStr) {
	try {
		const u = new URL(urlStr);
		return `${u.protocol}//${u.hostname}${u.port ? ":" + u.port : ""}`;
	} catch {
		return null;
	}
}

const connectSrc = new Set();
const mediaSrc = new Set();

// Add all extracted URLs to connect-src and media-src
for (const urlStr of allUrls) {
	const hp = hostPort(urlStr);
	if (hp) {
		connectSrc.add(hp);
		mediaSrc.add(hp);
	}
}

// Known redirect targets and CDN hosts that audio URLs resolve through
const knownRedirects = [
	"https://18243.live.streamtheworld.com",
	"https://kexp-podcast.streamguys1.com",
	"https://dcs-cached.megaphone.fm",
	"https://dcs-spotify.megaphone.fm",
	"https://rsscom.pdn.tritondigital.com",
	"https://developers.podcast.go-aws.com",
	"https://download-cdn.talkpython.fm",
];
for (const u of knownRedirects) {
	connectSrc.add(u);
	mediaSrc.add(u);
}

// Wildcards for domains with multiple subdomains used at runtime
// (redirect targets, CDN subdomains, API subdomains)
const wildcardConnectSrc = [
	"https://*.open-meteo.com",      // api.open-meteo.com, air-quality-api.open-meteo.com
	"https://*.twitch.tv",           // gql.twitch.tv, embed.twitch.tv, player.twitch.tv
	"https://*.talkpython.fm",       // talkpython.fm, download-cdn.talkpython.fm
	"https://*.megaphone.fm",        // traffic, feeds, dcs-cached, dcs-spotify
	"https://*.podbean.com",         // mcdn.podbean.com redirects to s*.podbean.com
	"https://*.cloudfront.net",      // multiple CDN distributions for podcast audio
	"https://*.token.awswaf.com",    // WAF token endpoint
];
for (const w of wildcardConnectSrc) connectSrc.add(w);

const wildcardMediaSrc = [
	"https://*.megaphone.fm",
	"https://*.cloudfront.net",
	"https://*.talkpython.fm",
	"https://*.streamtheworld.com",
	"https://*.streamguys1.com",
	"https://*.podbean.com",
];
for (const w of wildcardMediaSrc) mediaSrc.add(w);

// Static origins needed by the site (not in streams.ts)
const staticConnectSrc = [
	"https://ipinfo.io",
	"https://cognito-idp.us-west-2.amazonaws.com",
];
for (const u of staticConnectSrc) connectSrc.add(u);

const imgSrc = [
	"https://i.gravatar.com",
	"https://i.ytimg.com",
	"https://secure.meetupstatic.com",
	"https://static-cdn.jtvnw.net",
];
const frameSrc = ["https://embed.twitch.tv", "https://www.youtube.com"];
const scriptSrc = ["https://cdn.babylonjs.com"];
const fontSrc = ["https://fonts.gstatic.com"];
const styleSrc = ["https://fonts.googleapis.com"];

// Remove non-audio origins from media-src
const nonMediaHosts = new Set([
	"https://ipinfo.io", "https://cognito-idp.us-west-2.amazonaws.com",
	"https://*.token.awswaf.com", "https://*.open-meteo.com",
	"https://*.twitch.tv",
	"https://api.kexp.org", "https://api.zeno.fm",
	"https://api.composer.nprstations.org", "https://api.open-meteo.com",
	"https://brand.nmsu.edu", "https://cargocollective.com",
	"https://conceptoradial.com", "https://ibero909.fm",
	"https://nmsufoundation.org", "https://udgtv.com",
	"https://www.kexp.org", "https://www.ksfr.org", "https://www.kutx.org",
	"https://www.radio.unam.mx", "https://www.omnycontent.com",
	"https://feed.podbean.com", "https://media.rss.com",
	"https://feeds.captivate.fm", "https://feeds.megaphone.fm",
	"https://aws-podcast.s3.amazonaws.com", "https://rustacean-station.org",
	"https://krux.nmsu.edu", "https://noasrv.caster.fm:10182",
]);
for (const h of nonMediaHosts) mediaSrc.delete(h);

const allowlist = {
	"connect-src": [...connectSrc].sort(),
	"media-src": [...mediaSrc].sort(),
	"img-src": imgSrc.sort(),
	"frame-src": frameSrc,
	"script-src": scriptSrc,
	"font-src": fontSrc,
	"style-src": styleSrc,
};

mkdirSync(OUT_DIR, { recursive: true });
writeFileSync(OUT_PATH, JSON.stringify(allowlist, null, 2) + "\n");
console.log(`✓ wrote ${OUT_PATH}`);
console.log(`  connect-src: ${allowlist["connect-src"].length} origins`);
console.log(`  media-src: ${allowlist["media-src"].length} origins`);

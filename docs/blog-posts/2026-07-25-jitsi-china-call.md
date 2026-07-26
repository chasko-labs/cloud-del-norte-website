---
title: "jitsi 'doesn't work in china' — except it was never actually banned for this"
date: 2026-07-25
tags: [jitsi, webrtc, networking, self-hosting]
summary: "the documented history says jitsi meet has been effectively unusable in mainland china since 2018. a browser-based self-hosted call still reached a participant there cleanly — not because of clever firewall circumvention, but because the ban and the browser call were never describing the same thing."
author: "bryan chasko"
---

# jitsi "doesn't work in china" — except it was never actually banned for this

a community member joined one of our video meetups from mainland china, over a self-hosted jitsi instance, through a browser tab. the call connected cleanly. no vpn mentioned, no special client, no drama.

that shouldn't have been surprising. the well-documented history of jitsi failing in china describes two specific, narrow restrictions — and a browser-based self-hosted instance was never inside the scope of either one.

## the documented history is real, and it's specific

in may 2018, china's ministry of industry and information technology directed apple to deactivate callkit — apple's ios framework for integrating voip calls into the native phone app, lock screen, and call log — in every app on the china app store. apple's notice to developers, [quoted directly in a jitsi github issue](https://github.com/jitsi/jitsi-meet/issues/3152) from that period, reads: "this app cannot be approved with callkit functionality active in china." google duo and cisco webex teams lost china distribution under the same directive. jitsi's own [community forum confirms the outcome](https://community.jitsi.org/t/chinese-version-clients-for-android-and-ios/49812) two years later: "for ios, because of the callkit issue, currently there is no such app in chinese apple store."

separately, a [2019 rocket.chat community thread](https://forums.rocket.chat/t/if-i-setup-a-rocket-chat-server-in-china-can-i-use-video-conference-due-to-jitsi-meet-is-banned-in-china-app-store/3359) has a user asking about video conferencing from inside china. a team member answers: "no, you can't. jitsi won't work in china." the thread's own follow-up explains why — jitsi's default configuration depends on google's stun servers to negotiate webrtc connections, and google's services have been comprehensively blocked in china for years.

both of those are real and easy to verify. neither one describes what we actually did.

## two restrictions, neither of which applies to a browser tab

the callkit ban is about ios-native call integration. callkit is what makes a voip call appear on your lock screen the way a cellular call does — deep os-level hooks that china's telecom surveillance infrastructure can't intercept the same way it intercepts carrier calls. a browser tab running jitsi's javascript doesn't touch callkit. it's a sandboxed web page, not a phone-integrated app. the directive that pulled jitsi's ios app from the china app store has nothing to say about a website.

the google stun dependency is a real network problem, but it's a google problem, not a webrtc problem. jitsi's default setup asks a google-operated service to help negotiate the connection, and google is blocked. self-host your own stun/turn infrastructure instead of relying on google's, and that specific dependency disappears — which is exactly what our setup does.

the "jitsi won't work in china" answer in that rocket.chat thread is correct for the situation being asked about — a native app, talking to google's infrastructure by default — and doesn't describe a self-hosted instance reached through a browser.

## china's domestic webrtc industry proves the protocol isn't broadly blocked

if china blocked browser-based webrtc as a protocol, it would break its own domestic video industry. tencent meeting's browser client uses webrtc. agora — a shanghai-based, nyse-listed company — runs webrtc infrastructure at massive scale inside china specifically because google's public webrtc reference servers are blocked; agora's own infrastructure exists to fill that gap. wechat mini programs support real-time audio and video using webrtc-derived protocols in embedded webviews.

a [2020 measurement study](https://corpus.lantern.io/findings/2020-barradas-poking__protozoa-wildcard-carrier-resilience-gfw/) (barradas et al., acm ccs) tested which webrtc-based services were reachable from inside china and found a mix — google hangouts and discord blocked, slack and gotomeeting reachable. the pattern isn't "webrtc is blocked." it's "specific services tied to already-blocked companies are blocked, and most other webrtc traffic passes through."

that's consistent with how technical research describes the great firewall operating more broadly: blocklists keyed to specific ip ranges and domains, not blanket rules against protocols. a small self-hosted instance on an ip range with no history and no association with any blocked service was never a target — not because we out-engineered a ban, but because we were never in the category the ban was written for.

## what we actually changed, and why it still mattered

none of that means configuration was irrelevant. we removed the google stun dependency so the connection doesn't wait on a service we know is blocked. we expose a tcp fallback alongside the normal udp media path, since restrictive networks are more likely to throttle udp than a tcp connection. we host in a region with better routing to east asia, because — separate from any blocking question — cross-pacific network paths have documented congestion, and shorter routes mean less of it.

those changes address real problems narrower than "china bans video calls." they're the reason the call felt clean rather than merely reachable.

## what this isn't

this is one call, not a guarantee.

it doesn't mean jitsi's ios app is back in china's app store — it isn't, as far as we can confirm. it doesn't mean self-hosting inside mainland china is legally uncomplicated — china's icp filing requirements and cybersecurity law apply to services hosted within the country regardless of protocol, and that's a question we didn't have to answer because our server isn't hosted there. it doesn't mean this is permanently stable — if this deployment ever became well-known enough or got associated with an ip range tied to something already blocked, that could change. the research is explicit that blocklists shift, and one successful call isn't a long-term reachability study.

the scope of what we can actually claim: a browser-based connection to a self-hosted jitsi instance, on an unremarkable ip range, with no google stun dependency, reached a participant in mainland china on one occasion without intervention.

## the actual takeaway

"jitsi doesn't work in china" is real, well-documented, and true — but it describes an app store policy decision and a dependency on a blocked company's infrastructure, not a blanket verdict on browser-based self-hosted webrtc.

if you're building something similar: identify which specific restriction you're actually worried about before assuming the whole category is closed to you. the fix for "our app can't ship in china's app store" and the fix for "our default config depends on a blocked service" are two different projects, and neither one requires accepting that the underlying technology doesn't work there.

## further reading

- [jitsi/jitsi-meet github issue #3152 — apple's callkit rejection notice, quoted in full](https://github.com/jitsi/jitsi-meet/issues/3152)
- [jitsi community forum — confirming no ios app in china's app store (may 2020)](https://community.jitsi.org/t/chinese-version-clients-for-android-and-ios/49812)
- [rocket.chat community forum — "jitsi won't work in china," with the stun-blocking mechanism explained (2019)](https://forums.rocket.chat/t/if-i-setup-a-rocket-chat-server-in-china-can-i-use-video-conference-due-to-jitsi-meet-is-banned-in-china-app-store/3359)
- [the register — apple's callkit directive covering china app store voip apps (may 2018)](https://www.theregister.com/2018/05/21/apple_tells_devs_to_ditch_callkit_in_china/)
- [barradas et al., acm ccs 2020 — measuring webrtc service reachability from inside china](https://corpus.lantern.io/findings/2020-barradas-poking__protozoa-wildcard-carrier-resilience-gfw/)

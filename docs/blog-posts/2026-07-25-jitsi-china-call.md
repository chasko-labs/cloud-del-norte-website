---
title: "jitsi and china's network restrictions — what's documented, what applied here"
date: 2026-07-25
tags: [jitsi, webrtc, networking, self-hosting]
summary: "two documented restrictions get cited as 'jitsi doesn't work in china.' neither applies to a browser-based self-hosted instance. here's what each restriction actually targets."
author: "bryan chasko"
---

# jitsi and china's network restrictions — what's documented, what applied here

a self-hosted jitsi instance, accessed through a browser, connected to a participant in mainland china.

there are two documented sources for the claim "jitsi doesn't work in china." neither describes this configuration.

## restriction 1: apple pulled jitsi's ios app from china's app store (2018)

in may 2018, china's ministry of industry and information technology directed apple to deactivate callkit in all china app store apps. callkit is apple's ios framework for integrating voip calls into the native phone app — lock screen, call log, system dialer ui. apple's developer notice, quoted in a jitsi github issue from that period: "this app cannot be approved with callkit functionality active in china." google duo and cisco webex teams lost china distribution under the same directive.

jitsi's community forum, may 2020: "for ios, because of the callkit issue, currently there is no such app in chinese apple store."

**scope**: this restriction targets an ios app using a specific ios framework. a browser tab running jitsi's javascript does not use callkit. this restriction does not apply to browser access.

## restriction 2: jitsi's default config depends on google's stun servers

a 2019 rocket.chat community thread: user asks about video conferencing from china, references the app store removal. rocket.chat staff reply: "no, you can't. jitsi won't work in china." the thread's follow-up identifies the mechanism: jitsi's default configuration uses google's stun servers for webrtc connection negotiation. google's services are blocked in china.

**scope**: this restriction targets a dependency on google's infrastructure, not webrtc itself. self-hosting your own stun/turn server removes the dependency. our deployment does this.

## what the domestic industry shows about webrtc as a protocol

china runs webrtc-based video at scale domestically. tencent meeting's browser client uses webrtc. agora (shanghai-based, nyse-listed) operates webrtc infrastructure inside china, including a mirror of google's public webrtc reference implementation, because the google-hosted version is blocked. wechat mini programs use webrtc-derived protocols for video in embedded webviews.

a 2020 peer-reviewed measurement (barradas et al., acm ccs) tested webrtc service reachability from inside china: google hangouts and discord were blocked, slack and gotomeeting were not. the pattern is service-specific blocking, not protocol-level blocking.

## what we configured

- removed the google stun dependency — the media server advertises its own address directly, so negotiation doesn't depend on reaching google
- exposed a tcp fallback alongside the default udp media path
- hosted in a region with shorter network routing to east asia, reducing round-trip latency

## what this doesn't confirm

- jitsi's ios app is still not distributed in china's app store, as far as we can verify
- self-hosting inside mainland china carries separate licensing requirements (icp filing, cybersecurity law compliance) that don't apply to a foreign-hosted server being reached from inside china — we didn't have to resolve that question because our server isn't hosted there
- this is one connection, not a reliability claim across networks, isps, or time
- if this deployment's ip range became associated with a blocked service, or the domain itself got added to a blocklist, the result could differ

## sources

- [jitsi/jitsi-meet github issue #3152 — apple's callkit rejection notice](https://github.com/jitsi/jitsi-meet/issues/3152)
- [jitsi community forum — confirming no ios app in china's app store, may 2020](https://community.jitsi.org/t/chinese-version-clients-for-android-and-ios/49812)
- [rocket.chat community forum — stun-blocking mechanism discussed, 2019](https://forums.rocket.chat/t/if-i-setup-a-rocket-chat-server-in-china-can-i-use-video-conference-due-to-jitsi-meet-is-banned-in-china-app-store/3359)
- [the register — apple's callkit directive, may 2018](https://www.theregister.com/2018/05/21/apple_tells_devs_to_ditch_callkit_in_china/)
- [barradas et al., acm ccs 2020 — webrtc service reachability from china](https://corpus.lantern.io/findings/2020-barradas-poking__protozoa-wildcard-carrier-resilience-gfw/)

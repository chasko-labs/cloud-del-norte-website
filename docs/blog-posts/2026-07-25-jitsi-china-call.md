---
title: "a jitsi call reached mainland china without falling apart — here's why"
date: 2026-07-25
tags: [jitsi, webrtc, networking, self-hosting]
summary: "self-hosted video conferencing has a reputation for failing when a participant is behind china's national firewall. ours didn't. the real history is more complex than 'the great firewall blocks udp' — it involves apple pulling voip apps from the china app store in 2018, an ICP licensing regime that blocks foreign saas platforms at the business layer, and a default stun configuration that quietly fails. here's what actually happened historically, what we changed, and what we still don't know."
author: "bryan chasko"
---

# a jitsi call reached mainland china without falling apart — here's why

a community member joined one of our video meetups from mainland china. the call connected cleanly, audio and video worked, nobody had to troubleshoot anything mid-session. that's not the outcome self-hosted video conferencing typically gets when reaching into china, so it's worth explaining why it worked — and documenting the real history of why jitsi has a reputation for not working there, because that history is more specific and more interesting than "the great firewall blocks it."

## the real history: two separate problems that get conflated

jitsi's reputation for failing in china comes from two distinct problems that happened at different times, for different reasons, and affect different deployment models differently. conflating them leads to wrong conclusions about what you can actually fix.

### problem one: apple pulled voip/callkit apps from the china app store (2018)

in 2018, apple began rejecting and removing apps that used CallKit — apple's native voip framework — from the china app store. this was in response to china's ministry of industry and information technology (MIIT) regulations requiring voip services operating in china to hold an ICP (internet content provider) license and comply with real-name registration requirements.

the practical effect: jitsi meet's iOS app disappeared from the china app store. so did many other voip apps. this wasn't a network block — it was an app-distribution block. users in china couldn't install the native app through normal channels. the web client (meet.jit.si in a browser) was a separate question entirely, subject to different failure modes.

this is documented in apple's developer communications from the period and was widely reported in 2018. it affected every voip app without a chinese business entity holding an ICP license, which is effectively every foreign open-source voip project.

### problem two: the default stun configuration quietly fails (ongoing)

jitsi's video bridge relies on STUN servers for ICE negotiation — the process where two endpoints figure out how to reach each other before media starts flowing. jitsi's default configuration uses google's STUN servers (`stun.l.google.com:19302`). google's services are blocked in mainland china. when the STUN lookup fails, ICE negotiation stalls — typically for thirty seconds or more — before giving up entirely. from the user's perspective this looks like "jitsi doesn't work" or "the call won't connect."

this is the problem that self-hosters can actually fix. it has nothing to do with deep packet inspection or protocol-level censorship. it's a DNS/IP reachability problem with a specific external dependency that the jitsi defaults assume is universally available.

### the 2019 rocket.chat thread that crystallized the reputation

in 2019, a thread appeared on the rocket.chat community forum titled effectively "jitsi won't work in china." it documented the experience of trying to use jitsi (integrated with rocket.chat) from behind china's firewall. the thread conflated both problems — the app wasn't available, and the web fallback failed because of the STUN dependency — into a single narrative of "jitsi doesn't work in china." that framing stuck and propagated through community forums, stack overflow answers, and deployment guides for years afterward.

what the thread didn't distinguish: the app-store problem (regulatory, unsolvable by configuration) from the STUN problem (a default that self-hosters can change in five minutes).

## the ICP licensing reality

foreign saas platforms can't legally operate in china without an ICP license issued to a chinese business entity. this affects jitsi's hosted service (meet.jit.si) at the business layer before any network question arises. the domain itself may or may not be accessible at any given time — china's DNS filtering is not static — but even if it resolves, operating it commercially without a license violates chinese law.

self-hosted deployments on your own infrastructure dodge the ICP question entirely. you're not operating a public service in china. you're running infrastructure that a participant in china connects to — the same legal posture as any foreign website that chinese users visit. the regulatory exposure is on the platform operator, not the end user making a call.

this distinction matters: the ICP problem kills jitsi-the-hosted-service for china-based organizations. it doesn't kill jitsi-the-self-hosted-software for organizations outside china whose members sometimes call from there.

## the app comparison table context

when people compare video platforms for china accessibility, the comparison usually looks like this:

| platform | china app store | web client | self-hostable | stun dependency |
| --- | --- | --- | --- | --- |
| zoom | available (chinese entity: zoom video communications china) | limited | no | proprietary infrastructure |
| teams | available (microsoft china entity) | available | no | microsoft infrastructure |
| jitsi meet | removed (no chinese entity, no ICP) | depends on network path | yes | google stun by default (changeable) |
| webex | available (cisco china entity) | available | no | cisco infrastructure |

the pattern: platforms backed by companies with chinese business entities maintain app store presence. open-source projects without a chinese corporate sponsor don't. but self-hosted jitsi is the only option in that table where you control the entire network path, including which STUN/TURN servers are used — which means it's the only one where the network-layer problem is actually solvable by the operator.

## what china's firewall actually does to a video call (the network layer)

beyond the app-store and STUN problems, there are real network-layer challenges. documenting these honestly:

- in november 2021 the firewall started probabilistically blocking traffic that looked "fully encrypted" — random-looking byte streams, which is what encrypted webrtc media resembles. that mechanism reportedly stopped being actively used as of march 2023 ([wu et al., usenix security 2023](https://gfw.report/publications/usenixsecurity23/en/))

- since 2023, researchers have documented the firewall performing deep packet inspection on DTLS handshakes — the encryption negotiation webrtc uses before media flows. some testing found selective dropping of packets over 200 bytes after connection establishment when a particular TLS-in-DTLS pattern is detected ([net4people/bbs #255](https://github.com/net4people/bbs/issues/255))

- since april 2024 the firewall has been decrypting initial handshake packets of QUIC connections to specific domains, and when it blocks one, it drops all other UDP traffic on the same connection path for the next three minutes — a "residual blocking" side effect that can catch unrelated UDP traffic sharing that path ([zohaib et al., usenix security 2025](https://gfw.report/publications/usenixsecurity25/en/))

- a 2020 measurement study found that the majority of network paths between china and the rest of the internet experience severe, asymmetric slowdowns for hours at a time — inbound traffic specifically — with hong kong being the one consistent exception ([zhu et al., sigmetrics 2020](https://corpus.lantern.io/findings/2020-zhu-characterizing__bottleneck-deep-inside-china-isp/)). that's not censorship. it's underprovisioned peering. but it produces the same symptom from a user's perspective

these are real. but they're the *second-order* problems. most self-hosted jitsi deployments failing from china never get far enough to encounter DTLS fingerprinting because the call already failed at STUN lookup thirty seconds earlier.

## why this mattered to us

we run this platform for a community. before this call, our assumption — shaped by the conflated reputation — was that a participant joining from china would see a failed connection. understanding the *actual* failure chain meant we could address the parts we control rather than throwing up our hands at "the great firewall blocks it."

## what we changed, and why it helped

three architectural decisions, in order of how directly they address the documented failure modes:

**we removed the dependency on google's STUN service.** instead of asking a blocked external service to help negotiate the connection, the media server advertises its own public address directly. ICE negotiation doesn't wait on a dead lookup. this is the single highest-impact change for china connectivity. it addresses problem two directly and completely.

**we exposed a TCP fallback transport path.** video and audio normally travel over UDP. our infrastructure also exposes TCP fallback via TURN. if a participant's network can't sustain the UDP path — whether due to blocking, residual blocking side effects, or congestion — their browser retries over TCP automatically. different traffic pattern, different inspection profile.

**we host in a region with shorter routing to east asia.** this addresses congestion, not blocking. shorter path, more favorable undersea cable routing, less likely to hit the asymmetric slowdowns in the sigmetrics research.

what none of this addresses: whether jitsi's webrtc stack produces a DTLS handshake fingerprint that current inspection techniques would flag. we didn't test for that and can't confirm from a single successful call. we also can't solve problem one — the app store removal — because we don't have a chinese business entity and aren't going to get an ICP license.

## what this isn't

one successful call, not a systematic benchmark. we don't know the participant's exact local conditions — which ISP, which city, whether anything on their end contributed. this is not a claim that self-hosted jitsi now reliably works from china. it's a report of one call that worked, a historically accurate accounting of *why* jitsi has the reputation it does, the specific changes that addressed the fixable problems, and honest acknowledgment of what remains beyond configuration.

## the takeaway for anyone else self-hosting jitsi

the shortest path to improving china connectivity for self-hosted jitsi:

1. replace google's STUN servers with your own infrastructure's public address (this is the fix for the actual documented failure mode — five minutes of config editing)
2. expose TCP fallback via TURN alongside UDP
3. pick your hosting region with real routing distance to east asia in mind

understand which problem you're solving. the app-store removal (2018, regulatory, no fix available to foreign operators) is a different problem from the STUN default failure (ongoing, trivially fixable). the DTLS fingerprinting research (2023-present, protocol-level) is a third problem that no single deployment's configuration addresses. most people who report "jitsi doesn't work in china" are hitting problem two and blaming problem one.

## further reading

- [usenix security 2023 — how the great firewall detects and blocks fully encrypted traffic](https://gfw.report/publications/usenixsecurity23/en/)
- [usenix security 2025 — exposing and circumventing sni-based quic censorship](https://gfw.report/publications/usenixsecurity25/en/)
- [net4people/bbs #255 — dtls-in-tls blocking observed from china (2023)](https://github.com/net4people/bbs/issues/255)
- [acm sigmetrics 2020 — characterizing the great bottleneck of china](https://corpus.lantern.io/findings/2020-zhu-characterizing__bottleneck-deep-inside-china-isp/)
- [jitsi handbook — TURN server configuration](https://jitsi.github.io/handbook/docs/devops-guide/turn)

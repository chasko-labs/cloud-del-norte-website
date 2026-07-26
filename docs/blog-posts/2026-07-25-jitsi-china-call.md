---
title: "a jitsi call reached mainland china without falling apart — here's why"
date: 2026-07-25
tags: [jitsi, webrtc, networking, self-hosting]
summary: "self-hosted video conferencing has a reputation for failing when a participant is behind china's national firewall. ours didn't. here's the architecture reasoning, the documented failure modes, and what we still don't know."
author: "bryan chasko"
---

# a jitsi call reached mainland china without falling apart — here's why

a community member joined one of our video meetups from mainland china. the call connected cleanly, audio and video worked, nobody had to troubleshoot anything mid-session. that's not the outcome self-hosted video conferencing typically gets when reaching into china, so it's worth explaining why it worked rather than just noting that it did.

## what china's firewall actually does to a video call

china's national firewall doesn't work like a simple blocklist. it inspects traffic patterns, throttles connections that look unusual, and selectively drops specific protocols at a scale most network operators outside china never encounter.

the documented history of webrtc traffic getting caught in this is more nuanced than "udp is blocked." a few things are confirmed by researchers who measured it directly:

- in november 2021 the firewall started probabilistically blocking traffic that looked "fully encrypted" — random-looking byte streams, which is what encrypted webrtc media resembles. that mechanism reportedly stopped being actively used as of march 2023 ([wu et al., usenix security 2023](https://gfw.report/publications/usenixsecurity23/en/))

- since 2023, researchers have documented the firewall performing deep packet inspection on dtls handshakes — the encryption negotiation webrtc uses before media flows. some testing found the first round trip after connection establishment is the critical window: if it matches a particular tls-in-dtls pattern, later packets over 200 bytes get selectively dropped ([net4people/bbs #255](https://github.com/net4people/bbs/issues/255))

- more recent work found this dtls fingerprinting has become a standard technique against webrtc-based traffic in multiple censoring regimes, targeting the specific handshake signature of common webrtc libraries rather than relying on generic machine-learning traffic analysis ([vilalonga et al., popets 2026](https://corpus.lantern.io/findings/2026-vilalonga-obscura-enabling-ephemeral__snowflake-dpi-dtls-fingerprint-blocking/))

- separately, since april 2024 the firewall has been decrypting initial handshake packets of quic connections to specific domains, and when it blocks one, it drops all other udp traffic on the same connection path for the next three minutes — a "residual blocking" side effect that can catch unrelated udp traffic sharing that path ([zohaib et al., usenix security 2025](https://gfw.report/publications/usenixsecurity25/en/))

then there's plain infrastructure congestion. a 2020 measurement study found that the majority of network paths between china and the rest of the internet experience severe, asymmetric slowdowns for hours at a time — inbound traffic specifically, not outbound requests — with hong kong being the one consistent exception ([zhu et al., sigmetrics 2020](https://corpus.lantern.io/findings/2020-zhu-characterizing__bottleneck-deep-inside-china-isp/)). that's not censorship. it's underprovisioned peering. but it produces the same symptom from a user's perspective: a call that won't connect or won't hold steady.

on top of all that, self-hosted jitsi has its own well-documented default failure mode: jitsi's video bridge relies on google's stun servers for ICE negotiation — the process two endpoints use to figure out how to reach each other before media starts flowing. google's services are broadly blocked in china. when the stun lookup fails, ICE negotiation stalls, often for thirty seconds or more, before giving up entirely. from the user's side this looks like "jitsi doesn't work."

what's notably absent, even after searching jitsi's community forums and github issues, is anyone explicitly documenting "jitsi failed because of the great firewall." corporate-firewall reports exist — people behind restrictive networks that block udp entirely report the same symptoms — but china-attributed jitsi failures are rare in english-language sources. that absence likely means failures happen silently, or get reported in venues we can't search, rather than that the problem doesn't exist.

## why this mattered to us

we run this platform for a community. before this call, our expectation was that a participant joining from china would see a failed or badly degraded connection. that's a real access problem. we want anyone in the community to join regardless of where they're calling from, and "it probably won't work from china" isn't an answer we were comfortable leaving unexamined.

## what we changed, and why it helped

three architectural decisions turned out to matter, in order of how directly they address the failure modes above:

**we removed the dependency on google's stun service.** instead of asking a blocked external service to help negotiate the connection, the media server advertises its own public address directly. ICE negotiation doesn't wait on a dead lookup. it either connects immediately or it doesn't — no thirty-second stall. this addresses the specific jitsi default-config failure mode, not the deeper dtls-fingerprinting concern.

**we exposed a fallback transport path.** video and audio normally travel over udp — faster, but also the more likely target for inspection and residual blocking per the research above. our infrastructure also exposes tcp fallback. if a participant's network can't sustain the udp path, their browser retries over tcp automatically. slower per packet, but a completely different traffic pattern than the udp/dtls path the more sophisticated inspection techniques target.

**we host in a region with shorter routing to east asia.** this doesn't address blocking, but it addresses congestion. a shorter path with more favorable undersea cable routing measurably cuts round-trip latency and is less likely to hit the asymmetric slowdowns documented in the sigmetrics research.

what none of this addresses: whether jitsi's webrtc stack produces a dtls handshake fingerprint that the 2023-2026 inspection techniques would flag. that research exists and is real. we didn't test for it and can't confirm one way or the other from a single successful call.

## what this isn't

one successful call, not a systematic benchmark. we don't know the participant's exact local conditions — which isp, which region, whether anything on their end (better routing, cached dns, plain luck in the congestion window) contributed. this is not a claim that self-hosted jitsi now reliably works from china. it's specifically not a claim that we've addressed the dtls-fingerprinting techniques in the research above. it's a report of one call that worked, the architectural reasoning we believe improved the odds, and an honest accounting of what we still don't know.

## the takeaway for anyone else self-hosting jitsi

if you're running your own jitsi deployment and want to give callers behind restrictive networks a fair shot at connecting: stop depending on external stun services that might be blocked, make sure your media server advertises its own address directly, expose tcp fallback alongside udp, and pick your hosting region with real routing distance in mind rather than what's convenient for your primary audience.

none of that requires exotic infrastructure. it requires reading your own configuration closely enough to notice which defaults quietly assume every caller has unrestricted access to the open internet — and changing the ones that don't hold. it also means being honest that some of what happens at the network-inspection layer is beyond what a single deployment's configuration can control. a call working once is evidence, not proof.

## further reading

- [usenix security 2023 — how the great firewall detects and blocks fully encrypted traffic](https://gfw.report/publications/usenixsecurity23/en/)
- [usenix security 2025 — exposing and circumventing sni-based quic censorship](https://gfw.report/publications/usenixsecurity25/en/)
- [net4people/bbs #255 — dtls-in-tls blocking observed from china (2023)](https://github.com/net4people/bbs/issues/255)
- [popets 2026 — dtls fingerprint blocking against webrtc-based circumvention tools](https://corpus.lantern.io/findings/2026-vilalonga-obscura-enabling-ephemeral__snowflake-dpi-dtls-fingerprint-blocking/)
- [acm sigmetrics 2020 — characterizing the great bottleneck of china](https://corpus.lantern.io/findings/2020-zhu-characterizing__bottleneck-deep-inside-china-isp/)
- [jitsi handbook — turn server configuration](https://jitsi.github.io/handbook/docs/devops-guide/turn)

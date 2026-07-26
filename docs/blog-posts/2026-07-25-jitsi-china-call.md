---
title: "a jitsi call reached mainland china without falling apart — here's why"
date: 2026-07-25
tags: [jitsi, webrtc, networking, self-hosting]
summary: "self-hosted video conferencing has a reputation for failing when a participant is behind china's national firewall. ours didn't. here's the architecture reasoning, not a victory lap."
author: "bryan chasko"
---

# a jitsi call reached mainland china without falling apart — here's why

a community member joined one of our video meetups from mainland china. the call connected cleanly, audio and video worked, and nobody had to troubleshoot anything mid-session. that's not supposed to be the default outcome for self-hosted video conferencing reaching into china, so it's worth explaining why it worked instead of just noting that it did.

## what china's firewall actually does to a video call

china's national firewall — commonly called the great firewall — doesn't work like a simple on/off switch for websites. it inspects traffic patterns, throttles connections that look unusual, and selectively blocks specific services and protocols, all at a scale most network operators outside china never have to think about.

self-hosted jitsi deployments run into trouble here for a specific, well-documented reason: by default, jitsi's video bridge relies on google's stun servers as part of ICE negotiation — the process two devices use to figure out how to reach each other directly over the internet before media starts flowing. google's services are broadly blocked in china. when the stun lookup fails, ICE negotiation stalls, often for thirty seconds or more, before the call gives up entirely. from the user's side this just looks like "jitsi doesn't work in china," and there are plenty of forum posts confirming that exact experience.

## why this mattered to us

we run this platform for a community, not a business. before this call, our expectation — based on the widely reported experience above — was that a participant joining from china would likely see a failed or badly degraded call. that's a real access problem: we want anyone in the community to be able to join, regardless of where they're calling from, and "it probably won't work from china" isn't an answer we were comfortable leaving unexamined.

## what we changed, and why it helped

three architectural decisions turned out to matter, in order of how directly they addressed the actual failure mode:

**we removed the dependency on google's stun service entirely.** instead of asking a blocked external service to help negotiate the connection, the media server is configured to advertise its own public address directly. this means ICE negotiation doesn't wait on, or depend on, a service that's unreachable from inside the firewall. it either works immediately or it doesn't — there's no thirty-second stall waiting on a dead lookup.

**we exposed a fallback transport path.** video and audio normally travel over udp, which is faster but also the more likely target for throttling or inspection on a restrictive network. our infrastructure also exposes a tcp fallback. if a participant's network struggles with the udp path, their browser can automatically retry over tcp instead — slower per packet, but far more likely to actually get through inspection that's more aggressive toward udp traffic.

**we host in a region with a shorter path to east asia.** picking a hosting region with more favorable undersea cable routing to east asia measurably cuts round-trip latency compared to hosting on the opposite coast of the united states. lower latency doesn't fix a blocked connection, but it does mean that once a connection is established, the call actually feels good — no noticeable lag, no talking over each other.

one more factor worth naming honestly, because it's not something we engineered on purpose: some research into how the firewall's more sophisticated traffic-inspection techniques work suggests they're applied selectively — not to every connection, and not uniformly across every cloud provider's address space. it's possible this played a role in why the connection got through cleanly. we can't confirm that without controlled testing from inside china, so we're not claiming it as a designed feature. it's a plausible contributing factor, not a guarantee.

## what this isn't

this is one successful call, not a systematic benchmark. we don't know the participant's exact local network conditions — whether their isp already had favorable routing that day, whether anything on their end helped, or whether a different network in china would see the same result. this is not a claim that self-hosted jitsi now reliably works for every caller in china. it's a report of one call that worked, and the specific architectural reasoning that we believe made it more likely to work.

## the takeaway for anyone else self-hosting jitsi

if you're running your own jitsi deployment and want to give callers behind restrictive networks — china's or otherwise — a fair shot at connecting, the pattern that helped us is straightforward: stop depending on external stun services that might be blocked, make sure your media server advertises its own address directly, expose a tcp fallback alongside udp, and pick your hosting region with real routing distance in mind, not just what's most convenient for your primary audience.

none of that requires exotic infrastructure. it requires reading your own configuration closely enough to notice which defaults quietly assume every caller has unrestricted access to the open internet — and changing the ones that don't hold up.

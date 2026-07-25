---
title: "a jitsi call connected from china — here is what the infrastructure did"
date: 2026-07-25
tags: [jitsi, webrtc, aws, infrastructure, china, networking]
summary: "tracing a single video call from a browser in mainland china through every layer of the stack — cognito, token exchange, prosody, fargate, and the JVB media bridge"
author: "bryan chasko"
---

# a jitsi call connected from china — here is what the infrastructure did

a participant in mainland china clicked "join meeting" on clouddelnorte.org. a few seconds later they were in a live video call with someone in new mexico. that click triggered a chain of infrastructure decisions across two aws accounts, four containers, a jwt signing secret, and a udp media relay — all running on fargate behind a network load balancer

this is what happened at each layer

## the browser — OIDC PKCE and session bootstrap

a participant had already authenticated via cognito hosted UI on `auth.clouddelnorte.org`. that flow used authorization code + PKCE against user pool `us-west-2_cyPQF4F3r` with app client `57eikmt418ea6vti2f6h0pl74r`. tokens landed in sessionStorage — id token, access token, refresh token

when they clicked join, the react frontend (cloudscape design system, vite MPA) called `fetchJitsiToken()`. that function pulled the id token from session storage and posted it to the token-exchange endpoint

## token exchange — lambda mints a jitsi JWT

the browser sent `POST https://rwmypxz9z6.execute-api.us-west-2.amazonaws.com/token/jitsi` with the cognito id token in the authorization header

API gateway's JWT authorizer (id `9uzqka`) validated the cognito token against the user pool. once validated, the request hit `cloud-del-norte-token-exchange` — a node 20 arm64 lambda in account `170473530355`

the lambda:

- decoded the cognito id token to extract claims (sub, email, cognito:groups)
- checked group membership: `moderators` get moderator context, `members` get participant context, `banned` get a 403
- read the HMAC signing secret from secrets manager (`cloud-del-norte/jitsi-jwt-secret-NTnVUY`) via KMS CMK `alias/cloud-del-norte`
- minted a jitsi JWT with claims: `iss: clouddelnorte-auth`, `aud: jitsi`, `sub: <cognito-sub>`, `room: *`, `context: { user: { name, email, moderator } }`
- returned the JWT and the jitsi domain (`meet.clouddelnorte.org`) to the browser

round trip: ~120ms from us-west-2. from china, with the pacific crossing and TLS negotiation: closer to 400-600ms

## script load — external_api.js from the jitsi web container

the browser loaded `https://meet.clouddelnorte.org/external_api.js`. that domain resolves via route53 (zone `Z045487217Y9179MTBU2Q` in account `211125425201`) to an A/AAAA alias pointing at the ALB (`jitsi-video-platform-web-alb`) in account `170473530355`

the ALB terminated TLS using the ACM cert for `meet.clouddelnorte.org` and forwarded to the target group. the target: port 80 on the jitsi-web container running inside the ECS task

from china this script load is the first real latency test. cloudfront is not in front of the jitsi web client (it serves the main site at clouddelnorte.org, not the meet subdomain). the participant's browser fetched the script directly from the ALB in us-west-2. depending on their ISP and the great firewall's mood that day, this took 1-4 seconds

## iframe instantiation — JitsiMeetExternalAPI

once external_api.js loaded, the frontend instantiated `JitsiMeetExternalAPI` with:

- `domain`: meet.clouddelnorte.org
- `roomName`: the meeting room slug
- `jwt`: the token from the exchange
- `parentNode`: a div in the react component
- `configOverwrite`: prejoin enabled, audio/video muted by default, no branding

the embed component started a 5-second cold-start timer. if `videoConferenceJoined` did not fire within 5s, it showed "meeting room is starting up, please wait…" — a signal that ECS might be scaling from zero or the SRTP negotiation was in progress. a 90-second unreachable timer ran in parallel as the hard ceiling

## prosody — XMPP authentication via JWT

inside the ECS task (task definition `jitsi-web:7`, 2 vCPU / 4 GB, four containers: web + prosody + jicofo + jvb), prosody received the SRTP handshake and validated the JWT

prosody checked:

- signature: HMAC-SHA256 against the shared secret (same one the lambda used to sign)
- issuer: `clouddelnorte-auth`
- audience: `jitsi`
- room claim: `*` (wildcard — this user can join any room)
- expiry: not expired

validation passed. prosody admitted the participant to the XMPP MUC (multi-user chat) room. jicofo — the conference focus component — noticed the new participant and instructed the JVB to allocate a channel

## JVB — the video bridge and UDP media relay

the jitsi videobridge (JVB) ran as the fourth container in the same ECS task. it needed to receive and send UDP media packets to the participant's browser

the NLB (`jitsi-video-platform-jvb-nlb`) exposed:

- UDP port 10000 — WebRTC media (SRTP/DTLS)
- TCP port 4443 — fallback for networks that block UDP

the participant's browser performed ICE (interactive connectivity establishment):

- gathered local candidates (host, server-reflexive via STUN)
- received the JVB's candidate: the NLB's elastic IP on port 10000/udp
- attempted UDP connectivity

from china, UDP 10000 to a US IP is the critical path. the great firewall does not categorically block UDP, but it does throttle and inspect. for this call, UDP succeeded — the participant's ISP did not drop the DTLS handshake, and the SRTP session established

if UDP had failed, the browser would have fallen back to TCP 4443 through the NLB's TCP target group. slower (TCP head-of-line blocking affects real-time media) but functional

## the media path in steady state

once connected:

- audio and video flowed as SRTP over UDP from the china participant to the JVB in us-west-2
- the JVB selectively forwarded media to other participants (SFU topology — no mixing, just routing)
- the other participant in new mexico had their own UDP path to the same JVB
- total one-way latency: ~180-250ms (china → us-west-2). acceptable for conversation. noticeable but not disruptive

the jitsi-web container served the UI. prosody maintained presence. jicofo managed the conference topology. JVB moved the bits. four containers, one task, one cluster, one call

## what the firewall did not block

this call worked because:

- HTTPS to the ALB (port 443) is universally permitted — the token exchange and script load succeeded
- UDP 10000 to a non-blacklisted IP passed through — the great firewall did not flag it
- the domain `meet.clouddelnorte.org` was not on any DNS blocklist — it resolved correctly from within china
- no google services were required — jitsi self-hosted avoids any dependency on googleapis.com, which is blocked

what could have gone wrong:

- if the ISP's UDP throttling had been aggressive that day, fallback to TCP 4443 would have added 50-100ms and introduced jitter
- if DNS resolution for `meet.clouddelnorte.org` had been poisoned, the participant would have seen "unable to connect" after 90 seconds
- if the great firewall had flagged the DTLS handshake pattern as VPN-like traffic, the connection would have died mid-negotiation

## infrastructure cost of this single call

the ECS task was already running (desired_count=1 for the active meeting window). no scale event triggered. the marginal cost:

- fargate compute: $0 incremental (task already provisioned)
- NLB: data processing charges on the UDP flow — negligible for a single call
- lambda invocation: one token-exchange call, ~120ms billed duration — fractions of a cent
- data transfer: cross-region media relay is the real cost — approximately 2-4 GB/hour for a two-participant 720p call, at $0.09/GB out from us-west-2

total incremental cost for this one call lasting 45 minutes: roughly $0.15-0.25 in data transfer

## what this proves

a self-hosted jitsi stack on AWS fargate, with cognito auth and a lambda token exchange, can serve a real-time video call to a participant in mainland china without any china-specific infrastructure. no multi-region JVB deployment. no TURN relay in hong kong. no special CDN configuration. just a well-configured stack in us-west-2 and a network path that happened to be open

this is not guaranteed. the next call might fail if the firewall tightens UDP inspection or if DNS gets poisoned. but for a community meetup platform — not a business-critical application — the architecture holds. and when it does not, the 90-second unreachable timeout surfaces the failure gracefully rather than leaving the participant in limbo

the infrastructure did exactly what it was built to do. authenticate, authorize, mint a token, validate it, allocate a media channel, and relay packets across the pacific. six layers, two accounts, four containers, one call

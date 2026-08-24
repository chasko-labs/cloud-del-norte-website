# Shared Meeting Lock — Cross-Site Jitsi Coordination

**date:** 2026-08-24
**author:** poltergeist-harald-core-anchor
**status:** LIVE — deployed and verified

## summary

Cloud Del Norte (quantum.clouddelnorte.org) and NE3D (ne3d.org) share a single Jitsi server at meet.clouddelnorte.org. Bryan organizes both communities and cannot run two meetings simultaneously on one Jitsi instance. Before today, either site could independently launch a meeting without knowing about the other — creating a collision risk where a NE3D monthly could stomp a CDN quantum computing workshop mid-session.

The shared meeting lock solves this with a singleton DynamoDB row that acts as a distributed mutex. Both sites check and acquire the lock atomically before launching, and both sites display the cross-site state to their users.

## architecture

| component | resource | account |
|-----------|----------|---------|
| lock table | DynamoDB `shared-meeting-lock` (PAY_PER_REQUEST, TTL) | 170473530355 (jitsi-video-hosting) |
| CDN launch | Lambda `cdn-admin-launch-meeting` | same |
| NE3D launch | Lambda `ne3d-admin-launch-meeting` | same |
| CDN end | Lambda `cdn-admin-end-meeting` | same |
| NE3D end | Lambda `ne3d-admin-end-meeting` | same |
| CDN status | Lambda `cdn-public-meeting-status` | same |
| NE3D status | Lambda `ne3d-public-meeting-status` | same |
| CDN frontend | quantum.clouddelnorte.org/dashboard | 211125425201 (CloudFront) |
| NE3D frontend | ne3d.org/meetings | 211125425201 (CloudFront) |
| Jitsi server | ECS `jitsi-cluster` / `jitsi-service` | 170473530355 |

## how the lock works

the lock table has one possible row:

```
pk: "lock" (singleton)
site: "cdn" | "ne3d"
roomName: string
title: string
launchedAt: ISO 8601
launchedBy: Cognito sub
expiresAt: epoch seconds (now + 4 hours)
```

### launch flow

```
moderator clicks Launch Meeting
  → Lambda reads shared-meeting-lock (GetItem pk=lock)
  → if lock exists AND expiresAt > now:
      return 409 {error: "Meeting in progress on <site>", lockedBy: {...}}
  → if no lock:
      PutItem with ConditionExpression="attribute_not_exists(pk)"
      (atomic — prevents race between two simultaneous launches)
  → if ConditionalCheckFailedException:
      re-read lock → return 409
  → lock acquired → write to site-specific meetings table → ensure ECS → return 200
```

### end flow

```
moderator clicks End Meeting
  → Lambda deletes from site meetings table (id=live)
  → Lambda deletes from shared-meeting-lock with ConditionExpression="site = :thisSite"
      (only deletes your own lock — cannot accidentally release the other site's lock)
```

### status flow (public, no auth required)

```
frontend polls /meetings/status every 15-30 seconds
  → Lambda reads site-specific meetings table for live/scheduled state
  → Lambda reads shared-meeting-lock for crossSiteLock field
  → returns {live, scheduled, crossSiteLock: {site, title, roomName, launchedAt} | null}
```

## fail-open design

every lock operation is wrapped in try/catch. if DynamoDB is unreachable or the lock table has an issue:

- launch proceeds without acquiring the lock (logs the error, does not block the meeting)
- end proceeds without releasing the lock (TTL will clean it up in 4 hours)
- status returns crossSiteLock: null (the banner simply does not appear)

the Jitsi server is not coupled to the lock. a lock table outage means both sites lose collision awareness but retain full meeting functionality. the TTL guarantees stale locks self-expire — no manual cleanup ever needed.

## cross-site UI

both sites display a yellow warning banner when the other site holds the lock:

- CDN users see: "Meeting in progress on NE3D — the Jitsi server is occupied"
- NE3D users see: "Meeting in progress on Cloud Del Norte — the Jitsi server is occupied"

the banner shows the meeting title and how long ago it started. it disappears automatically when the lock is released or expires.

## what stays separate

the two sites remain fully independent portals. they do NOT share:

- Cognito user pools (separate auth domains, separate user bases)
- API Gateways (CDN: rwmypxz9z6, NE3D: arkosqxnv4)
- site-specific meetings DynamoDB tables (cloud-del-norte-meetings, ne3d-meetings)
- frontend deployments (separate S3 buckets, separate CloudFront distributions)

the ONLY shared resources are:

- the Jitsi ECS cluster + service (meet.clouddelnorte.org)
- the shared-meeting-lock DynamoDB table
- the jitsi-video-hosting AWS account (170473530355)

## design principles

**singleton mutex pattern** — one row, one table, atomic conditional writes. simpler than SQS queues, step functions, or eventbridge coordination. a DynamoDB conditional put is the cheapest possible distributed lock that guarantees single-writer semantics.

**TTL as garbage collection** — a 4-hour TTL means even if an end-meeting call fails (network partition, Lambda timeout, operator forgets), the lock self-heals. no cron, no watchdog, no manual intervention.

**condition-scoped deletion** — the end Lambda only deletes the lock if `site = :thisSite`. this prevents a race where CDN ends its meeting at the exact moment NE3D acquires the lock — CDN cannot accidentally release NE3D's lock.

**fail-open over fail-closed** — a broken lock table should never prevent a meeting from happening. the lock is an awareness mechanism, not a hard gate. if both sites collide because the table was unreachable, that's a 1-in-1000 event; blocking 100% of meetings because the lock table is down would be a 100% event.

**zero new infrastructure** — no new ECS services, no new VPCs, no new networking. one DynamoDB table, inline policy additions to existing roles, code updates to existing Lambdas. the entire feature has zero monthly cost at rest (PAY_PER_REQUEST, no provisioned capacity) and a cost per meeting of approximately $0.000025 (5 DDB operations at $0.25/million).

## PRs

- chasko-labs/cloud-del-norte-website#540 — CDN frontend (merged)
- chasko-labs/ne3d-website#95 — NE3D frontend (merged)
- infrastructure deployed directly (DDB table, IAM, Lambda code) — no terraform, intentional for velocity; terraform import available later if needed
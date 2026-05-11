# Behavioral Logic Map — Cloud Del Norte

> Predicting where users get confused before they get confused.

## What This Is

A map of every decision point, logic gap, and friction point in clouddelnorte.org. Each entry is testable against the live site. Each friction point has a severity, a confirmed source file, and a predicted user behavior.

## Three Pillars

1. **Mental Models** — What each role expects to happen (and where they're wrong)
2. **Decision Trees** — Every If/Then path through auth, navigation, calls, and permissions
3. **Friction Points** — 19 confirmed points where user logic clashes with app logic

## Stack

| Component | Implementation | Account |
|-----------|---------------|---------|
| Auth | Cognito us-west-2_cyPQF4F3r, MFA SOFTWARE_TOKEN, no remember-device | 170473530355 |
| Video | Jitsi embedded iframe, meet.clouddelnorte.org, ECS Fargate, scale-to-zero | 170473530355 |
| Frontend | React + Vite + Cloudscape, S3 + CloudFront (ECC3LP1BL2CZS) | 211125425201 |
| API | API Gateway (rwmypxz9z6), Lambda (token-exchange, admin, meetings) | 170473530355 |
| CI | Woodpecker → S3 sync → CloudFront invalidation | Push gateway on rocm-aibox |

## Roles

| Role | Group Claim | How Assigned | Can Do |
|------|------------|--------------|--------|
| Admin | moderators | Existing moderator promotes via admin panel | Everything |
| Member | members | Admin approves from Pending tab | Join calls, view meetings |
| Pending | (empty) | Automatic after signup | Browse public content only |
| Guest | N/A (no token) | Not logged in | Browse public content, listen to radio |

## Document Index

| Document | Path | Status |
|----------|------|--------|
| User Mental Models | [./mental-models/](./mental-models/) | Confirmed |
| — Admin (Moderator) | [./mental-models/admin.md](./mental-models/admin.md) | Confirmed |
| — Member | [./mental-models/member.md](./mental-models/member.md) | Confirmed |
| — Guest (Logged-Out) | [./mental-models/guest.md](./mental-models/guest.md) | Confirmed |
| Logic Decision Trees | [./decision-trees/](./decision-trees/) | Confirmed |
| — Auth Flow | [./decision-trees/auth-flow.md](./decision-trees/auth-flow.md) | Confirmed |
| — Join Call Flow | [./decision-trees/join-call-flow.md](./decision-trees/join-call-flow.md) | Confirmed |
| — Navigation Flow | [./decision-trees/navigation-flow.md](./decision-trees/navigation-flow.md) | Confirmed |
| — Permissions Flow | [./decision-trees/permissions-flow.md](./decision-trees/permissions-flow.md) | Confirmed |
| — Infrastructure Flows | [./decision-trees/infrastructure-flows.md](./decision-trees/infrastructure-flows.md) | Confirmed |
| Friction Points Registry | [./friction-points.md](./friction-points.md) | Confirmed (19 entries) |
| Secure Join Behavioral Path | [./secure-join-map.md](./secure-join-map.md) | Confirmed |
| Nomenclature | [./nomenclature.md](./nomenclature.md) | Confirmed |

## Key Findings

| # | Finding | Impact | Source |
|---|---------|--------|--------|
| 1 | First-time user: 4-7 min + unknown approval wait before first call | Abandonment | secure-join-map.md |
| 2 | MFA setup has no help text, no app store links, no escape | S1 — account locked if abandoned | auth-flow.md AUTH-04b |
| 3 | Admin nav visible to all roles (PHANTOM_NAVIGATION) | Confusion | navigation-flow.md NAV-02 |
| 4 | Approved user must re-login to get new permissions | Support burden | permissions-flow.md PERM-03 |
| 5 | ECS cold-start adds 30-90s with no user messaging | "Is it broken?" | infrastructure-flows.md INFRA-01 |
| 6 | No notification system (signup → admin, approval → user) | Black hole | infrastructure-flows.md INFRA-04 |
| 7 | "sign in with passkey" hardcoded English in Spanish mode | i18n gap | auth-flow.md AUTH-01 |

## Sprint Plan

- **Sprint 1:** ~~Research + skeleton creation~~ ✓ Complete (2026-05-11)
- **Sprint 2 (current):** ~~Source audit + 3 revision passes~~ ✓ Complete (2026-05-11)
- **Sprint 3:** Validate against live site via Chrome DevTools + exploratory testing
- **Sprint 4:** Prioritize fixes, create implementation tickets from friction points

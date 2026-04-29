# clouddelnorte.org asset map

canonical reference for the clouddelnorte.org domain surface. produced from stratia codebase analysis 2026-04-29. check this before any work touching CF distributions, S3 buckets, or CI pipelines for this domain.

---

## 1. domains + CF distributions

| hostname                | CF distribution id | S3 bucket                    | build target | default root object | IaC                       |
| ----------------------- | ------------------ | ---------------------------- | ------------ | ------------------- | ------------------------- |
| clouddelnorte.org       | ECC3LP1BL2CZS      | s3://awsaerospace.org        | build:main   | feed/index.html     | ✗ no IaC                  |
| dev.clouddelnorte.org   | EEHVTUEQ97V0X      | s3://dev.clouddelnorte.org   | build:main   | (not confirmed)     | ✓ infra/dev-site.cfn.yaml |
| auth.clouddelnorte.org  | ECQ44FO9MBTCY      | s3://auth.clouddelnorte.org  | build:auth   | (not confirmed)     | ✗ no IaC                  |
| awsug.clouddelnorte.org | E2QLAWFVIT1AR8     | s3://awsug.clouddelnorte.org | build:awsug  | (not confirmed)     | ✗ no IaC                  |

all four distributions serve from account 211125425201 (aerospaceug-admin). only the dev distribution has IaC — `infra/dev-site.cfn.yaml`.

---

## 2. build targets

| npm script                         | source                                  | output dir         | deploy destination                                                           |
| ---------------------------------- | --------------------------------------- | ------------------ | ---------------------------------------------------------------------------- |
| build:main                         | src/pages/\*                            | lib/               | s3://awsaerospace.org/ (prod) + s3://dev.clouddelnorte.org/ (dev mirror)     |
| build:auth                         | src/sites/auth                          | lib-auth/          | s3://auth.clouddelnorte.org/                                                 |
| build:awsug                        | src/sites/awsug                         | lib-awsug/         | s3://awsug.clouddelnorte.org/                                                |
| build:embed                        | sumerian-hosts/src/embed/liora-embed.ts | dist/liora-embed/  | s3://awsaerospace.org/liora-embed/ + s3://dev.clouddelnorte.org/liora-embed/ |
| build:assets + build:skybox-assets | sumerian-hosts/src/liora-assets/\*      | dist/liora-assets/ | s3://awsaerospace.org/liora/ + s3://dev.clouddelnorte.org/liora/             |

**vite.config.ts rollup inputs (page routes):** feed, home, roadmap, meetings, create-meeting, learning/api, maintenance-calendar, theme, auth/callback, admin

embed + asset builds live in `chasko-labs/sumerian-hosts` — not in `chasko-labs/cloud-del-norte-website`. the deploy paths overlap (same S3 buckets), which is why the exclude rule exists (section 6).

---

## 3. CI flow

### cloud-del-norte-website — `.woodpecker/deploy.yml`

single pipeline, branch-conditional steps:

- push to `main` → build:main → sync to s3://awsaerospace.org → invalidate CF ECC3LP1BL2CZS
- push to `dev` → build:main → sync to s3://dev.clouddelnorte.org → invalidate CF EEHVTUEQ97V0X
- build:auth + build:awsug run per-branch as applicable, sync to their respective buckets

### sumerian-hosts — `.woodpecker/main.yml`

tier model:

| tier   | what runs                                                                   |
| ------ | --------------------------------------------------------------------------- |
| tier-0 | gate checks — branch guard, change detection                                |
| tier-1 | lint + build + test                                                         |
| tier-2 | deploy — main branch ships to prod S3 paths, dev branch ships to dev mirror |

tier-2 ships `dist/liora-embed/` → s3://awsaerospace.org/liora-embed/ (prod) and s3://dev.clouddelnorte.org/liora-embed/ (dev). same for `dist/liora-assets/` → the liora/ prefix.

### auth chain (both pipelines)

workload x509 cert + aws_signing_helper → IAM RolesAnywhere ci-profile (arn: `arn:aws:rolesanywhere:us-west-2:211125425201:profile/2177db77-a33c-4e5b-bcce-21b908659406`) → `heraldstack-ci-deploy` role in account 211125425201

---

## 4. AWS account topology

| account                         | id           | what it holds                                                                                                                 |
| ------------------------------- | ------------ | ----------------------------------------------------------------------------------------------------------------------------- |
| aerospaceug-admin / chasko-labs | 211125425201 | 4 CF distributions, 4 S3 buckets, Route53 zone (inferred), heraldstack-ci-deploy role, RolesAnywhere trust anchor             |
| kiro                            | 946179428633 | sumerian-hosts-playground stack (TTS lambda, sumerian-hosts-site bucket, dev playground) — does NOT hold clouddelnorte.org CF |
| msp-ghel (candidate)            | 889670351271 | Cognito user pool likely here — unconfirmed                                                                                   |
| msp-foundation (candidate)      | 809797236453 | Cognito user pool possibly here — unconfirmed                                                                                 |

the Cognito hosted UI domain is `cloud-del-norte.auth.us-west-2.amazoncognito.com`. the pool was not found in 211125425201 or 946179428633 via `aws cognito-idp list-user-pools`. pool id, client id, account location, and pool IaC are all gaps — see section 5.

---

## 5. Route53 + Cognito gaps

| gap                                                            | to confirm                                                                                                                                                              |
| -------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| (gap) prod CF ECC3LP1BL2CZS — no IaC                           | author CloudFormation or CDK for the distribution; use dev-site.cfn.yaml as the template reference                                                                      |
| (gap) auth CF ECQ44FO9MBTCY — no IaC                           | same — draft IaC, reconcile with any manual config drift                                                                                                                |
| (gap) awsug CF E2QLAWFVIT1AR8 — no IaC                         | same                                                                                                                                                                    |
| (gap) Route53 hosted zone for clouddelnorte.org — no IaC       | confirm zone id via `aws route53 list-hosted-zones --profile aerospaceug-admin`; author IaC                                                                             |
| (gap) Cognito user pool account — unconfirmed                  | run `aws cognito-idp list-user-pools --max-results 60` against 889670351271 and 809797236453; match on hosted domain `cloud-del-norte.auth.us-west-2.amazoncognito.com` |
| (gap) Cognito pool id + client id — unknown                    | obtain from whichever account owns the pool                                                                                                                             |
| (gap) Cognito IaC — none anywhere local                        | author CloudFormation for user pool + app client + hosted domain once account is confirmed                                                                              |
| (gap) dev CF EEHVTUEQ97V0X default root object — not confirmed | inspect dev distribution config: `aws cloudfront get-distribution-config --id EEHVTUEQ97V0X`                                                                            |

---

## 6. deploy exclude rule

every `aws s3 sync` targeting clouddelnorte.org buckets MUST include:

```
--exclude "liora/*" --exclude "liora-embed/*"
```

the `liora/` and `liora-embed/` prefixes in s3://awsaerospace.org/ are owned exclusively by sumerian-hosts CI. a cdn-website sync without these excludes wipes the embed bundle. recovery is manual and requires re-running the sumerian-hosts tier-2 deploy.

**recovery procedure if violated:**

1. do not re-run the cdn-website pipeline — that will not restore the liora paths
2. trigger a sumerian-hosts `main.yml` run on the main branch — this re-ships `dist/liora-embed/` and `dist/liora-assets/` to their S3 prefixes
3. invalidate CF ECC3LP1BL2CZS paths `/liora/*` and `/liora-embed/*` after the sync completes
4. verify embed loads at clouddelnorte.org using the verifier pattern (section 9)

the exclude flags are already present in both CI pipelines. violations occur on ad-hoc manual syncs — treat any manual `aws s3 sync` to these buckets as a high-risk operation requiring explicit flag audit before execution.

---

## 7. recent manual changes not in IaC

| date       | distribution         | change                                                                | etag at change time |
| ---------- | -------------------- | --------------------------------------------------------------------- | ------------------- |
| 2026-04-29 | ECC3LP1BL2CZS (prod) | DefaultRootObject changed from `home/index.html` to `feed/index.html` | E2RT6ZXEPAVGVK      |

this change was applied via aws cli, not reflected in any IaC. when prod CF IaC is authored (section 5 gap), this value must be included. do not re-read the distribution config to derive the value — use the table above as the source of truth for this session state.

---

## 8. issue routing

| issue type                                      | target repo                                                                          |
| ----------------------------------------------- | ------------------------------------------------------------------------------------ |
| auth UI, login, signup, Cognito client behavior | chasko-labs/cloud-del-norte-website                                                  |
| liora panel, embed bundle, animation, voice     | chasko-labs/sumerian-hosts                                                           |
| site deploy, CF config, S3 sync                 | chasko-labs/cloud-del-norte-website                                                  |
| Cognito pool IaC, MFA setup, hosted domain      | chasko-labs/cloud-del-norte-website with `infra` label (no dedicated infra repo yet) |
| sumerian-hosts CI pipeline                      | chasko-labs/sumerian-hosts                                                           |

---

## 9. verifier pattern reference

do not duplicate verifier recipe content here. use the canonical sources:

- shannon-level e2e testing recipe (chrome-for-testing + xvfb :99 + EGL pattern): `~/code/heraldstack/shannon-claude-code-cli/docs/liora-end-to-end-testing.md`
- consumer-side testing runbook: `~/code/chasko-labs/cloud-del-norte-website/docs/testing-runbook.md`
- embed contract tests: `~/code/chasko-labs/sumerian-hosts/docs/host-page-testing.md`

---

## 10. open questions

- **Cognito pool account** — not found in 211125425201 or 946179428633. most likely msp-ghel (889670351271) or msp-foundation (809797236453). requires `list-user-pools` sweep across both accounts to confirm
- **IaC reconciliation** — three CF distributions (ECC3LP1BL2CZS, ECQ44FO9MBTCY, E2QLAWFVIT1AR8) have no IaC. Route53 zone has no IaC. no dedicated infra repo exists yet — all infra IaC currently lives in `infra/` within cloud-del-norte-website
- **prod CF defaults for auth + awsug distributions** — DefaultRootObject for ECQ44FO9MBTCY and E2QLAWFVIT1AR8 not captured in stratia's session. retrieve before authoring IaC
- **dev CF default root object** — EEHVTUEQ97V0X default root object not confirmed; inspect before assuming parity with prod

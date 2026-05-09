# project context — cloud-del-norte-website

## what this repo is

cloud-del-norte-website is a React + Vite SPA for the Cloud Del Norte community college CS program website. Deployed to AWS (S3 + CloudFront). Authenticated via Cognito on a dedicated auth subdomain.

## stack

- React 18 + Vite
- AWS Cloudscape Design System (UI components)
- Amazon Cognito (auth — hosted UI on auth subdomain, token flow via redirect)
- Vitest (unit/integration tests)
- Woodpecker CI (build, deploy, device-farm testing)
- S3 + CloudFront (hosting)

## deploy targets

- Production: S3 bucket via Woodpecker pipeline on main merge
- Preview: per-branch deploys on PR (CloudFront invalidation)

## testing infrastructure

- **Device Farm integration**: `.woodpecker/device-farm.yml` — runs cross-browser/device tests on AWS Device Farm
- **Test suite**: `tests/device-farm/` — pytest-based tests (auth flows, broken links, console errors, API access)
- **Credentials**: SSM Parameter Store at `/device-farm/test-users/*`
- **Infra repo**: `chasko-labs/aws-device-farm-infra` (Terraform for Device Farm project + device pools)

## notable architectural facts

- Auth subdomain pattern: Cognito hosted UI on `auth.{domain}`, token exchange via redirect back to app
- Token flow: authorization code grant → token endpoint → access/id/refresh tokens stored in session
- Vitest runs in CI on every PR; Device Farm runs on main merge
- Cloudscape components are the only permitted UI library — no MUI, no Tailwind
- Static assets in `public/` are deployed as-is to S3 root

## the rule in one sentence

repo-type behaviors live in `~/.kiro/steering/repo-types/react-vite.md`; only project-specific deviations and notable architectural facts belong here

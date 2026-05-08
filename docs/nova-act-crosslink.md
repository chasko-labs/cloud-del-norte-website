# splintercells nova-act — awareness note

this site's E2E and visual-regression flows use playwright/chromium locally via the liora E2E testing recipe (reference: `feedback_liora_e2e_testing` — chrome-for-testing + xvfb :99 + EGL on rocm-aibox). that is the primary path for verifying the liora-embed bundle at clouddelnorte.org.

the splintercells deepagents harness provides a complementary cloud-hosted tier: AWS Nova Act can exercise browser workflows without requiring a local chromium instance. this is not a replacement.

## entry point

`invoke_nova_act_workflow` tool on the heraldstack-nova-mcp server at `http://rocm-aibox.local:8170/mcp` (or localhost:8170 from rocm-aibox).

rate limit: 3 concurrent invocations, 30-minute timeout per slot (valkey semaphore).

## when nova-act is appropriate for this repo

- scheduled visual-regression checks that run without a local playwright session
- verifying the liora-embed CDN endpoint from a remote host
- multi-instance parallel flows

## when local playwright testing is correct

- interactive E2E sessions against the live clouddelnorte.org CloudFront distribution
- anything requiring the EGL/ROCm GPU path for WebGL surface verification
- flows that depend on local BryanChasko aws credentials for S3 diff checks

## implementation reference

`BryanChasko/splintercells-deep-agents-cli` — see `docs/architecture.md` for tool signatures, aws auth, and rate limiter behavior.

aws account note: nova-act runs in the kiro account (946179428633, us-east-1). the liora-embed production deploy target is the awsaerospace account (211125425201). these are distinct accounts — nova-act invocations do not touch the awsaerospace S3 bucket or CloudFront distribution unless explicitly wired.

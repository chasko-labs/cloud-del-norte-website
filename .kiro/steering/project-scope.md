# project scope — cloud-del-norte-website

## what this file does

scope governs what agents operating in `cloud-del-norte-website` may touch. work outside the in-scope table escalates upstream rather than landing here.

## in-scope work

| work type | owner agent |
| --------- | ----------- |
| React components + pages (Cloudscape) | poltergeist-harald-cdn-product-owner |
| Vite config + build pipeline | poltergeist-harald-cdn-product-owner |
| Vitest unit/integration tests | poltergeist-harald-cdn-product-owner |
| Device Farm test suite (tests/device-farm/) | ghost-orin-ci-cd |
| Woodpecker CI pipelines (.woodpecker/) | ghost-orin-ci-cd |
| CSS/styling fixes | ghost-liora-css-repair |
| Documentation + content | poltergeist-voss-chasko-author |

## out-of-scope work

| work type | escalates to |
| --------- | ------------ |
| Cognito/IAM infrastructure changes | chasko-labs/aws-device-farm-infra or haunting-kiro-cli (stratia-aws-infra) |
| Haunting agent definitions | haunting-kiro-cli repo |
| Chrome extension work | chrome-extension-moodle-uploader repo |
| Device Farm infra (Terraform) | chasko-labs/aws-device-farm-infra |

## escalation patterns

| trigger | route |
| ------- | ----- |
| Auth flow broken (Cognito config) | dispatch poltergeist-stratia-aws-infra |
| Device Farm infra change needed | dispatch to aws-device-farm-infra repo |
| CI pipeline structural change | ghost-orin-ci-cd |
| Scope violation detected | name violation, identify receiving repo, dispatch — never inline-fix |

## the rule in one sentence

agents in `cloud-del-norte-website` only touch in-scope work; out-of-scope observations route to the receiving repo via the escalation pattern, never inline patches

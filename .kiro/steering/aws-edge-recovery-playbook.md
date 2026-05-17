# aws edge recovery playbook

## what this doc is

steering doc for any agent or operator triaging an AWS edge issue (Lambda Function URL, API Gateway, CloudFront, Cognito, IAM) on a cloud-del-norte-website surface. read this BEFORE attempting fixes when symptoms involve auth, gateway behavior, or HTTP-layer rejection. complements `docs/runbooks/diagnostic-first.md` (which covers browser/network/auth/infra diagnostic patterns broadly); this doc is specific to the Lambda-edge failure mode discovered in Wave 7 and the proven architectural pivot.

## the dual-permission rule

lambda function URL with AuthType=NONE requires BOTH:

1. AuthType=NONE on the function URL config
2. resource policy with Principal:\* + Action lambda:InvokeFunctionUrl + Condition lambda:FunctionUrlAuthType=NONE

but even with both correct, the function URL gateway can return 403 AccessDeniedException pre-Lambda due to internal AWS state drift.

wave 7 evidence chain:

| signal | result |
|--------|--------|
| AuthType | NONE |
| resource policy | correct (Principal:\*, InvokeFunctionUrl, condition NONE) |
| CORS preflight | 200 |
| POST via browser | 403 AccessDeniedException |
| remove+readd permission (fresh statement-id) | 403 |
| delete+recreate function URL (new URL) | 403 |
| 60s IAM propagation wait | 403 |
| SCPs, RCPs, declarative policies, VPC binding | none found |
| direct SDK invoke (aws lambda invoke) | 200, correct response, created GH issue #196 |

conclusion: gateway state became unrecoverable. the fix path is architectural pivot to API Gateway, NOT continued debugging of the function URL state.

## diagnostic-first protocol for aws edge

when a request to an AWS edge (Lambda Function URL, API Gateway, CloudFront route) returns an unexpected status, ESPECIALLY 403/AccessDeniedException, the FIRST diagnostic move is direct SDK invoke against the Lambda. this separates Lambda runtime health from gateway/edge auth.

three outcomes:

| result | meaning | next step |
|--------|---------|-----------|
| Lambda 200 + correct response | gateway is the problem | pivot or repair the edge |
| Lambda non-200 | Lambda is the problem | fix code, then re-test |
| invoke timeout/permission denied | your CLI session has issues | fix CLI auth first |

command:

```bash
aws lambda invoke \
  --function-name <function-name> \
  --payload '{"httpMethod":"POST","body":"{\"type\":\"bug\",\"summary\":\"smoke test\"}"}' \
  --cli-binary-format raw-in-base64-out \
  --profile jitsi-video-hosting \
  --region us-west-2 \
  /tmp/lambda-resp.json

cat /tmp/lambda-resp.json
```

this single invocation told us in seconds that cdn-feedback Lambda was healthy and the gateway was the sole failure point. wave 7 would have pivoted 40 minutes earlier with this as step 1.

## escalation thresholds

two failed fix attempts on a function URL gateway issue = next step is architectural pivot (API Gateway HTTP V2 mirror), not a 3rd attempt.

| scenario | cost |
|----------|------|
| wave 7 without this rule | ~40 minutes of permission/policy/URL recreation + 60s IAM waits before pivoting |
| with this rule | pivot decision made in 1 diagnostic invoke |

the threshold is TWO. not three. not "try one more thing." two failed attempts with a confirmed-healthy Lambda = pivot.

a "failed fix attempt" means: you changed something (permission, URL config, policy statement), waited for propagation (minimum 60s for IAM), and the symptom persists. if you haven't waited 60s, it doesn't count as a failed attempt — it counts as impatience.

## the API Gateway HTTP V2 pivot pattern

proven canonical pattern from `scripts/deploy-feedback-apigw.sh` (commit ee051c3a):

1. author `scripts/deploy-<service>-apigw.sh` modeled on existing pattern (idempotent create-or-update, `set -euo pipefail`, SSO check, `trap ERR`)
2. API Gateway V2 with ProtocolType HTTP, $default stage AutoDeploy=true, CORS allowed origins for cdn subdomains
3. Lambda integration with PayloadFormatVersion 2.0
4. POST route integration (e.g. `POST /feedback`)
5. Lambda permission for principal apigateway.amazonaws.com on action lambda:InvokeFunction with source-arn `arn:aws:execute-api:<region>:<account>:<api-id>/*/POST/<route>`
6. update `.env.production` VITE\_\<SERVICE\>\_API\_URL to `https://<api-id>.execute-api.<region>.amazonaws.com/<route>`
7. CSP for main + awsug + auth subdomains already allows `https://*.execute-api.us-west-2.amazonaws.com` on connect-src — NO CSP CHANGE needed for this pivot. this was the only-frontend-touch insight.
8. manual deploy via `./scripts/deploy-manual.sh` until Woodpecker is operational
9. smoke-test with curl from each cdn origin to verify CORS:

```bash
for ORIGIN in https://clouddelnorte.org https://awsug.clouddelnorte.org https://dev.clouddelnorte.org; do
  curl -s -o /dev/null -w "%{http_code}" \
    -X POST \
    -H "Content-Type: application/json" \
    -H "Origin: $ORIGIN" \
    -d '{"type":"bug","summary":"smoke"}' \
    "https://<api-id>.execute-api.us-west-2.amazonaws.com/<route>"
  echo " $ORIGIN"
done
```

## evidence chain template

when documenting an AWS edge resolution, capture these receipts (this is what made wave 7's diagnosis verifiable):

| evidence | command or source |
|----------|-------------------|
| Lambda direct SDK invoke status + response body | `aws lambda invoke` output |
| GitHub issue created as proof Lambda is healthy | issue URL (e.g. #196) |
| function URL config dump | `aws lambda get-function-url-config --function-name <name> --region <region> --profile <profile>` |
| resource policy dump | `aws lambda get-policy --function-name <name> --region <region> --profile <profile>` |
| CloudWatch logs window | last successful invocation timestamp + first failed invocation timestamp |
| for pivot: new endpoint URL | the execute-api URL from deploy script output |
| bundle hash drift | grep new URL in deployed JS bundle (e.g. `grep rknnfq6urf lib/assets/*.js`) |
| curl smoke from each origin | CORS verification per origin |

the CloudWatch window is critical: wave 7's last successful function URL invocation was 2026-05-16T15:40:51Z (wave 3 smoke test). every request after that was rejected pre-Lambda (no log entry). that gap between "last success" and "first failure with no log" is the signature of gateway-level rejection vs Lambda-level failure.

## what NOT to do

- do NOT delete the broken function URL during pivot — leave it as transitional fallback. cleanup is a future-session item.
- do NOT add new CSP entries without verifying the existing wildcard already covers the new endpoint:

```bash
curl -sI https://clouddelnorte.org | grep -i content-security-policy | grep -o 'connect-src[^;]*'
```

grep for `execute-api` or `lambda-url` before touching CSP.

- do NOT modify the Lambda code during the pivot — Lambda is healthy by hypothesis (confirmed via SDK invoke). architecture pivot only touches the front-door.
- do NOT `--amend` prior commits during the pivot. single atomic commit per phase (script, env+wire, deploy).

## referenced commits

| hash | description |
|------|-------------|
| ee051c3a | feat(feedback): API Gateway HTTP V2 deploy script (pivot from broken Function URL) |
| 7d4719ec | feat(feedback): pivot to API Gateway HTTP V2, retire broken Function URL |
| 80b031e5 | docs(handoff): 2026-05-17 00:14 UTC — Wave 7 (full diagnosis chain) |

## the rule in one sentence

a 403 from a Lambda Function URL gateway with a correct resource policy is a state-corruption signal, not a permission problem; pivot to API Gateway after one failed retry.

---

see also: `docs/runbooks/diagnostic-first.md` for the general two-failed-attempts rule across all layers (browser, network, auth, infra). this playbook is the AWS-edge-specific instantiation of that principle.

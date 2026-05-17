# aws resources — cloud-del-norte-website

## accounts

| account id | alias | role |
| ---------- | ----- | ---- |
| 170473530355 | jitsi-video-hosting | primary workload — lambdas, cognito, dynamodb, api gateways |
| 211125425201 | aerospaceug-admin | s3 hosting, cloudfront, ses, route53 |
| 946179428633 | kiro | nova act (us-east-1), device farm |

## regions

| region | usage |
| ------ | ----- |
| us-west-2 | primary — all lambdas, cognito, dynamodb, api gateways, ssm |
| us-east-1 | cost-aggregator lambda, nova act |

## lambdas (account 170473530355, us-west-2)

| function | purpose | trigger |
| -------- | ------- | ------- |
| cdn-feedback | bug/wish form → github issue creation | api gateway http v2 |
| cdn-speaker-proposals | speaker proposal form → ddb + ses + github issue | api gateway rest v1 |
| cost-aggregator | cross-account cost roll-up | eventbridge (us-east-1) |
| cloud-del-norte-meet admin lambdas | cognito admin ops (approve, list, patch) | portal api gateway |

## api gateways (account 170473530355, us-west-2)

| name | id | type | endpoint |
| ---- | -- | ---- | -------- |
| cdn-feedback-api | rknnfq6urf | HTTP V2 | https://rknnfq6urf.execute-api.us-west-2.amazonaws.com/feedback |
| cdn-speaker-proposals-api | 7526ltaid2 | REST V1 + WAF | https://7526ltaid2.execute-api.us-west-2.amazonaws.com/prod |
| portal api (cloud-del-norte-meet) | rwmypxz9z6 | REST V1 | https://rwmypxz9z6.execute-api.us-west-2.amazonaws.com/prod |

## waf (account 170473530355, us-west-2)

| webacl | attached to | rules |
| ------ | ----------- | ----- |
| cdn-speaker-proposals-webacl | cdn-speaker-proposals-api | AmazonIpReputationList + RateLimit 100/5min + Challenge on POST /proposals |

## dynamodb (account 170473530355, us-west-2)

| table | purpose |
| ----- | ------- |
| cdn-speaker-proposals | speaker proposal submissions |
| cdn-speaker-proposals-rate | per-ip rate tracking |

## cognito (account 170473530355, us-west-2)

| resource | value |
| -------- | ----- |
| user pool id | us-west-2_cyPQF4F3r |
| auth domain | auth.clouddelnorte.org (hosted ui) |
| groups | members, moderators |

## ssm parameter store paths

| prefix | account | contents |
| ------ | ------- | -------- |
| /cloud-del-norte/speaker-proposals/* | 170473530355 | github-token (SecureString) |
| /cloud-del-norte/test/* | 170473530355 | smoketest-user-password, member-only-user-password, member-only-user-email |
| /device-farm/test-users/* | 170473530355 | device farm credentials |
| /heraldstack/identity/cloud-del-norte-website/* | 170473530355 | agent identity params |

## cloudfront (account 211125425201)

see .kiro/steering/deployment.md for distribution IDs and bucket mapping.

## ses (account 211125425201, us-west-2)

| identity | status | usage |
| -------- | ------ | ----- |
| clouddelnorte.org | verified (DKIM) | speaker proposal notifications, approval emails |
| recipient: bryanj+clouddelnortespeakerrequest@abstractspacecraft.com | verified | notification target |

## the rule in one sentence

account 170473530355 runs compute + auth + data; account 211125425201 runs hosting + email + dns; account 946179428633 runs testing infrastructure.

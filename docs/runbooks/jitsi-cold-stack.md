# jitsi cold-stack runbook

## symptom

`meet.clouddelnorte.org/external_api.js` returns HTTP 503 with server header `awselb/2.0`. this means zero healthy targets are registered in the web target group behind the ALB. the jitsi ECS service is either scaled to zero or the task failed to start.

a second, more dangerous mode: the web UI loads (room appears normal) but audio and video fail silently. this indicates the JVB media target groups are unhealthy while the web target group is healthy.

## diagnosis

### check ECS desired and running count

```bash
aws ecs describe-services \
  --cluster jitsi-cluster \
  --services jitsi-service \
  --query 'services[0].{desired:desiredCount,running:runningCount,status:status}' \
  --output table \
  --profile jitsi-video-hosting \
  --region us-west-2
```

if `desiredCount = 0`: the service was intentionally scaled down by a controller.
if `desiredCount > 0` but `runningCount = 0`: the task is failing to start (check events below).

### check recent service events

```bash
aws ecs describe-services \
  --cluster jitsi-cluster \
  --services jitsi-service \
  --query 'services[0].events[:10].{at:createdAt,msg:message}' \
  --output table \
  --profile jitsi-video-hosting \
  --region us-west-2
```

### check target group health

```bash
# web (ALB)
aws elbv2 describe-target-health \
  --target-group-arn "$(aws elbv2 describe-target-groups --names jitsi-video-platform-web-tg --query 'TargetGroups[0].TargetGroupArn' --output text --profile jitsi-video-hosting --region us-west-2)" \
  --profile jitsi-video-hosting --region us-west-2

# JVB TCP (NLB)
aws elbv2 describe-target-health \
  --target-group-arn "$(aws elbv2 describe-target-groups --names jitsi-video-platform-jvb-tcp-tg --query 'TargetGroups[0].TargetGroupArn' --output text --profile jitsi-video-hosting --region us-west-2)" \
  --profile jitsi-video-hosting --region us-west-2

# JVB UDP (NLB)
aws elbv2 describe-target-health \
  --target-group-arn "$(aws elbv2 describe-target-groups --names jitsi-video-platform-jvb-udp-tg --query 'TargetGroups[0].TargetGroupArn' --output text --profile jitsi-video-hosting --region us-west-2)" \
  --profile jitsi-video-hosting --region us-west-2
```

## known cause — 2026-07-31 incident

**duration**: 4h 40m total outage (18:12Z – 22:53Z)

**root cause**: EventBridge rule `ne3d-meeting-duration-watchdog` running on `rate(15 minutes)` invoked a Lambda of the same name. that Lambda scaled `jitsi-service` to `desiredCount=0`. the service is a SHARED resource backing scheduled public events — the watchdog treated it as a single-session resource.

**current state**: the rule is DISABLED as of 2026-07-31.

```bash
# verify the rule is still disabled
aws events describe-rule \
  --name ne3d-meeting-duration-watchdog \
  --profile jitsi-video-hosting \
  --region us-west-2 \
  --query '{state:State,schedule:ScheduleExpression}'
```

**exact reversal** (DO NOT run until target-registration automation exists):

```bash
aws events enable-rule \
  --name ne3d-meeting-duration-watchdog \
  --profile jitsi-video-hosting \
  --region us-west-2
```

## structural vulnerability — JVB target groups not attached to ECS service

the ECS service `jitsi-service` only registers targets for `jitsi-video-platform-web-tg` (the web container on port 80). the JVB target groups (`jitsi-video-platform-jvb-tcp-tg` on port 4443 and `jitsi-video-platform-jvb-udp-tg` on port 10000) are NOT attached to the ECS service.

consequences:

- every task replacement (deployment, crash, scale event) orphans JVB target registration
- stale IPs from dead tasks remain registered, failing health checks
- the live task IP is NOT automatically registered
- this failure mode is SILENT — ECS reports the service as healthy because the web container passes its attached health check

### remediation when JVB targets are unhealthy

1. find the live task IP:

```bash
TASK_ARN=$(aws ecs list-tasks --cluster jitsi-cluster --service-name jitsi-service --query 'taskArns[0]' --output text --profile jitsi-video-hosting --region us-west-2)

TASK_IP=$(aws ecs describe-tasks --cluster jitsi-cluster --tasks "${TASK_ARN}" --query 'tasks[0].attachments[0].details[?name==`privateIPv4Address`].value | [0]' --output text --profile jitsi-video-hosting --region us-west-2)

echo "live task IP: ${TASK_IP}"
```

2. deregister stale targets:

```bash
# get current targets for JVB UDP TG
JVB_UDP_ARN=$(aws elbv2 describe-target-groups --names jitsi-video-platform-jvb-udp-tg --query 'TargetGroups[0].TargetGroupArn' --output text --profile jitsi-video-hosting --region us-west-2)

# deregister all stale IPs (replace with actual stale IPs from describe-target-health output)
aws elbv2 deregister-targets \
  --target-group-arn "${JVB_UDP_ARN}" \
  --targets Id=<STALE_IP>,Port=10000 \
  --profile jitsi-video-hosting --region us-west-2

# repeat for JVB TCP TG
JVB_TCP_ARN=$(aws elbv2 describe-target-groups --names jitsi-video-platform-jvb-tcp-tg --query 'TargetGroups[0].TargetGroupArn' --output text --profile jitsi-video-hosting --region us-west-2)

aws elbv2 deregister-targets \
  --target-group-arn "${JVB_TCP_ARN}" \
  --targets Id=<STALE_IP>,Port=4443 \
  --profile jitsi-video-hosting --region us-west-2
```

3. register the live task IP:

```bash
aws elbv2 register-targets \
  --target-group-arn "${JVB_UDP_ARN}" \
  --targets Id="${TASK_IP}",Port=10000 \
  --profile jitsi-video-hosting --region us-west-2

aws elbv2 register-targets \
  --target-group-arn "${JVB_TCP_ARN}" \
  --targets Id="${TASK_IP}",Port=4443 \
  --profile jitsi-video-hosting --region us-west-2
```

4. wait 30-60s for health checks to pass, then verify:

```bash
aws elbv2 describe-target-health --target-group-arn "${JVB_UDP_ARN}" --profile jitsi-video-hosting --region us-west-2
aws elbv2 describe-target-health --target-group-arn "${JVB_TCP_ARN}" --profile jitsi-video-hosting --region us-west-2
```

## permanent fixes — priority order

1. **attach JVB target groups to the ECS service** — add `loadBalancers` entries for the `jvb` container targeting port 4443 (TCP TG) and port 10000 (UDP TG). requires service recreation because ECS load balancer config is immutable after create. this is the correct fix.

2. **Lambda-based target registration** — EventBridge rule on ECS task state change (RUNNING) triggers a Lambda that registers the new task IP in both JVB target groups and deregisters any stale IPs. less correct but does not require service recreation.

3. **CloudWatch alarms on JVB target group health** — implemented in `infra/jitsi-ops-alarms.cfn.yaml`. does not fix the problem but ensures it is detected within 2 minutes instead of hours.

## the watchdog must NOT be re-enabled until

- JVB target groups are attached to the ECS service (fix #1 above), OR
- Lambda-based target registration automation is in place (fix #2 above)

without target-registration automation, re-enabling the watchdog means every scale-to-zero → scale-up cycle leaves JVB targets orphaned and media silently broken.

## well-architected tension

aggressive scale-to-zero serves **Cost Optimization** and **Sustainability** — ECS Fargate at 0 tasks costs $0 and the jitsi stack runs ~$0.50-1.50/hour when up.

**Reliability** requires that a shared resource backing scheduled public events not disappear without notice. the correct resolution is not "always on" or "always off" — it is:

- **session-awareness**: the scale-down controller must check for active participants before scaling to zero
- **upcoming-event awareness**: a pre-warm rule fires independently of the scale-down controller, scaling to 1 task N minutes before the next scheduled meeting (source: existing DynamoDB tables + meetings UI schedule)
- **scheduled pre-warm windows**: fixed windows (e.g. Tue/Thu 18:00-21:00 MT for regular meetup hours) as a floor
- **notification on scale-down**: the EventBridge rule in `jitsi-ops-alarms.cfn.yaml` announces any desiredCount-to-zero event so the operator knows immediately

the answer is: tell someone when it goes to zero, and pre-warm before scheduled events.

## references

- issue #469: observability gap analysis and alarm specification
- issue #470: JVB target group structural vulnerability diagnosis
- alarm IaC: `infra/jitsi-ops-alarms.cfn.yaml`
- deploy script: `scripts/deploy-jitsi-ops-alarms.sh`
- jitsi ops repo: `chasko-labs/jitsi-video-hosting-ops`

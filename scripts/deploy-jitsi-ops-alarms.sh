#!/usr/bin/env bash
# deploy-jitsi-ops-alarms.sh
# deploys the jitsi-ops-alarms CloudFormation stack to account 170473530355
# (jitsi-video-hosting profile, us-west-2). creates CloudWatch alarms and an
# SNS topic for jitsi ECS operational monitoring.
#
# requires: aws cli v2, jitsi-video-hosting SSO profile active
#
# usage:
#   ./scripts/deploy-jitsi-ops-alarms.sh \
#     --email operator@example.com \
#     --ntfy https://ntfy.sh/cdn-jitsi-ops-abc12345
#
#   ./scripts/deploy-jitsi-ops-alarms.sh --dry-run
#
# environment variables (alternative to flags):
#   JITSI_OPS_EMAIL    — email subscription endpoint
#   JITSI_OPS_NTFY     — ntfy.sh HTTPS endpoint
#
# never hardcode credentials, phone numbers, or email addresses in this script.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TEMPLATE="${REPO_ROOT}/infra/jitsi-ops-alarms.cfn.yaml"
STACK_NAME="jitsi-ops-alarms"
REGION="us-west-2"
PROFILE="jitsi-video-hosting"

# defaults from env
EMAIL="${JITSI_OPS_EMAIL:-}"
NTFY="${JITSI_OPS_NTFY:-}"
DRY_RUN=false

# ---------------------------------------------------------------------------
# argument parsing
# ---------------------------------------------------------------------------
while [[ $# -gt 0 ]]; do
  case "$1" in
    --email) EMAIL="$2"; shift 2 ;;
    --ntfy) NTFY="$2"; shift 2 ;;
    --dry-run) DRY_RUN=true; shift ;;
    --help|-h)
      echo "usage: $0 [--email <addr>] [--ntfy <url>] [--dry-run]"
      exit 0
      ;;
    *) echo >&2 "unknown argument: $1"; exit 2 ;;
  esac
done

# ---------------------------------------------------------------------------
# SSO session precheck — fail early with a clear message
# ---------------------------------------------------------------------------
sso_check() {
  if ! aws sts get-caller-identity --profile "${PROFILE}" --region "${REGION}" >/dev/null 2>&1; then
    echo >&2 "ERROR: SSO session for profile '${PROFILE}' is not active."
    echo >&2 "Run:  aws sso login --profile ${PROFILE}"
    exit 1
  fi
}

trap 'echo >&2 "ERROR: command failed at line ${LINENO}"; exit 1' ERR

echo "verifying SSO session for profile '${PROFILE}'…"
sso_check
echo "SSO session active."

# ---------------------------------------------------------------------------
# resolve target group and load balancer full-names from the live account
# ---------------------------------------------------------------------------
echo "resolving target group and load balancer identifiers…"

resolve_tg_fullname() {
  local name="$1"
  local arn
  arn="$(aws elbv2 describe-target-groups \
    --names "${name}" \
    --query 'TargetGroups[0].TargetGroupArn' \
    --output text \
    --profile "${PROFILE}" \
    --region "${REGION}" 2>/dev/null)" || {
    echo >&2 "ERROR: target group '${name}' not found in ${REGION}"
    exit 1
  }
  # extract targetgroup/<name>/<hex> from the full ARN
  echo "${arn}" | sed 's|.*:targetgroup|targetgroup|'
}

resolve_lb_fullname() {
  local name="$1"
  local arn
  arn="$(aws elbv2 describe-load-balancers \
    --names "${name}" \
    --query 'LoadBalancers[0].LoadBalancerArn' \
    --output text \
    --profile "${PROFILE}" \
    --region "${REGION}" 2>/dev/null)" || {
    echo >&2 "ERROR: load balancer '${name}' not found in ${REGION}"
    exit 1
  }
  # extract app/<name>/<hex> or net/<name>/<hex> from the full ARN
  echo "${arn}" | sed 's|.*:loadbalancer/||'
}

WEB_TG_FULL="$(resolve_tg_fullname jitsi-video-platform-web-tg)"
JVB_TCP_TG_FULL="$(resolve_tg_fullname jitsi-video-platform-jvb-tcp-tg)"
JVB_UDP_TG_FULL="$(resolve_tg_fullname jitsi-video-platform-jvb-udp-tg)"
WEB_ALB_FULL="$(resolve_lb_fullname jitsi-video-platform-web-alb)"
JVB_NLB_FULL="$(resolve_lb_fullname jitsi-video-platform-jvb-nlb)"

echo "  web TG:      ${WEB_TG_FULL}"
echo "  jvb-tcp TG:  ${JVB_TCP_TG_FULL}"
echo "  jvb-udp TG:  ${JVB_UDP_TG_FULL}"
echo "  web ALB:     ${WEB_ALB_FULL}"
echo "  jvb NLB:     ${JVB_NLB_FULL}"

# ---------------------------------------------------------------------------
# build parameter overrides
# ---------------------------------------------------------------------------
PARAMS=(
  "WebTargetGroupFullName=${WEB_TG_FULL}"
  "JvbTcpTargetGroupFullName=${JVB_TCP_TG_FULL}"
  "JvbUdpTargetGroupFullName=${JVB_UDP_TG_FULL}"
  "WebAlbFullName=${WEB_ALB_FULL}"
  "JvbNlbFullName=${JVB_NLB_FULL}"
)

if [[ -n "${EMAIL}" ]]; then
  PARAMS+=("NotificationEmail=${EMAIL}")
fi

if [[ -n "${NTFY}" ]]; then
  PARAMS+=("NtfyEndpoint=${NTFY}")
fi

# ---------------------------------------------------------------------------
# dry-run: create change set and display it without executing
# ---------------------------------------------------------------------------
if [[ "${DRY_RUN}" == "true" ]]; then
  echo ""
  echo "DRY RUN — creating change set without applying…"
  CHANGESET_NAME="jitsi-ops-alarms-dryrun-$(date +%s)"

  aws cloudformation create-change-set \
    --template-body "file://${TEMPLATE}" \
    --stack-name "${STACK_NAME}" \
    --change-set-name "${CHANGESET_NAME}" \
    --capabilities CAPABILITY_NAMED_IAM \
    --region "${REGION}" \
    --profile "${PROFILE}" \
    --parameters $(printf 'ParameterKey=%s,ParameterValue=%s ' "${PARAMS[@]//=/ }") \
    --output text >/dev/null 2>&1 || true

  echo "waiting for change set to complete…"
  aws cloudformation wait change-set-create-complete \
    --stack-name "${STACK_NAME}" \
    --change-set-name "${CHANGESET_NAME}" \
    --region "${REGION}" \
    --profile "${PROFILE}" 2>/dev/null || true

  echo ""
  echo "change set contents:"
  aws cloudformation describe-change-set \
    --stack-name "${STACK_NAME}" \
    --change-set-name "${CHANGESET_NAME}" \
    --region "${REGION}" \
    --profile "${PROFILE}" \
    --query 'Changes[].ResourceChange.{Action:Action,LogicalId:LogicalResourceId,Type:ResourceType}' \
    --output table 2>/dev/null || echo "(stack may not exist yet — change set shows full creation)"

  # clean up dry-run change set
  aws cloudformation delete-change-set \
    --stack-name "${STACK_NAME}" \
    --change-set-name "${CHANGESET_NAME}" \
    --region "${REGION}" \
    --profile "${PROFILE}" 2>/dev/null || true

  echo ""
  echo "dry run complete. no resources were created or modified."
  exit 0
fi

# ---------------------------------------------------------------------------
# deploy: create-or-update the stack
# ---------------------------------------------------------------------------
echo ""
echo "deploying stack '${STACK_NAME}' to ${REGION}…"

aws cloudformation deploy \
  --template-file "${TEMPLATE}" \
  --stack-name "${STACK_NAME}" \
  --capabilities CAPABILITY_NAMED_IAM \
  --region "${REGION}" \
  --profile "${PROFILE}" \
  --parameter-overrides "${PARAMS[@]}" \
  --tags project=cloud-del-norte env=prod owner=bryanchasko cost-center=heraldstack

echo ""
echo "stack deployed successfully."
echo ""

# ---------------------------------------------------------------------------
# output: print resulting resources
# ---------------------------------------------------------------------------
echo "alarm names:"
aws cloudformation describe-stacks \
  --stack-name "${STACK_NAME}" \
  --region "${REGION}" \
  --profile "${PROFILE}" \
  --query "Stacks[0].Outputs[?contains(OutputKey,'Alarm')].{Key:OutputKey,Value:OutputValue}" \
  --output table

echo ""
echo "SNS topic ARN:"
aws cloudformation describe-stacks \
  --stack-name "${STACK_NAME}" \
  --region "${REGION}" \
  --profile "${PROFILE}" \
  --query "Stacks[0].Outputs[?OutputKey=='TopicArn'].OutputValue" \
  --output text

if [[ -n "${EMAIL}" ]]; then
  echo ""
  echo "confirmation email sent to the configured address — click the link to activate."
fi

if [[ -n "${NTFY}" ]]; then
  echo ""
  echo "ntfy.sh subscription created — confirm via the ntfy.sh topic."
fi

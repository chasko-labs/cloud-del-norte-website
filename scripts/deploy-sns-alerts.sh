#!/usr/bin/env bash
# deploy-sns-alerts.sh
# deploys the cdn-deploy-alerts SNS stack with an admin-capable AWS profile.
# run this once from rocm-aibox as bryan (or any principal with cloudformation:*,
# sns:*, iam:PutRolePolicy on heraldstack-ci-deploy).
#
# requires: aws cli, aerospaceug-admin profile (or equivalent with cfn + sns + iam perms)
#
# usage:
#   AWS_PROFILE=aerospaceug-admin ./scripts/deploy-sns-alerts.sh
#
# or pass the profile explicitly:
#   ./scripts/deploy-sns-alerts.sh --profile aerospaceug-admin

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TEMPLATE="${REPO_ROOT}/infra/sns-deploy-alerts.cfn.yaml"
STACK_NAME="cdn-deploy-alerts"
REGION="us-west-2"

aws cloudformation deploy \
  --template-file "${TEMPLATE}" \
  --stack-name "${STACK_NAME}" \
  --capabilities CAPABILITY_NAMED_IAM \
  --region "${REGION}" \
  "$@"

echo ""
echo "stack deployed. topic arn:"
aws cloudformation describe-stacks \
  --stack-name "${STACK_NAME}" \
  --region "${REGION}" \
  --query "Stacks[0].Outputs[?OutputKey=='TopicArn'].OutputValue" \
  --output text \
  "$@"

echo ""
echo "confirmation SMS sent to +15756393994 — reply Y to activate the subscription."

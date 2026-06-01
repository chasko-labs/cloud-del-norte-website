#!/usr/bin/env bash
# One-time: remove SMS subscription from cdn-deploy-alerts to cut costs.
# Email subscription stays (free tier). Prod deploy notifications remain.
set -euo pipefail
AWS_PROFILE="${AWS_PROFILE:-aerospaceug-admin}"
TOPIC_ARN="arn:aws:sns:us-west-2:211125425201:cdn-deploy-alerts"

# Find the SMS subscription
SMS_SUB=$(aws sns list-subscriptions-by-topic --topic-arn "$TOPIC_ARN" \
	--query 'Subscriptions[?Protocol==`sms`].SubscriptionArn' --output text)

if [ -n "$SMS_SUB" ] && [ "$SMS_SUB" != "None" ]; then
	echo "Removing SMS subscription: $SMS_SUB"
	aws sns unsubscribe --subscription-arn "$SMS_SUB"
	echo "Done. Email subscription retained."
else
	echo "No SMS subscription found (already removed or pending confirmation)."
fi

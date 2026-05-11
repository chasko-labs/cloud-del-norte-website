// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import Alert from "@cloudscape-design/components/alert";
import { useTranslation } from "../../../../hooks/useTranslation";
import { getAuthState } from "../../_shared/auth";
import { useGroupMembership } from "../../_shared/use-group-membership";

/**
 * Global pending-approval banner (FP-003 + FP-017).
 * Renders only when the user is logged in with no Cognito group membership.
 * Disappears automatically once the silent token refresh detects group assignment.
 */
export function PendingApprovalBanner() {
	const { t } = useTranslation();
	const hasGroups = useGroupMembership();

	// Not logged in or already has groups — render nothing
	const auth = getAuthState();
	if (!auth || hasGroups) return null;

	return (
		<Alert type="info" header={t("awsug.pendingApproval.header")}>
			{t("awsug.pendingApproval.body")}
			<br />
			{t("awsug.pendingApproval.noRelogin")}
		</Alert>
	);
}

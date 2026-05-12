// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import Alert from "@cloudscape-design/components/alert";
import { useTranslation } from "../../../../hooks/useTranslation";
import { getAuthState } from "../../_shared/auth";
import { useGroupMembership } from "../../_shared/use-group-membership";

/**
 * Global pending-approval banner (FP-003 + FP-017).
 * Renders only when the user is logged in with no Cognito group membership.
 * When silent token refresh detects group assignment, a hard reload fires and
 * this component re-mounts with fresh auth state (banner gone).
 */
export function PendingApprovalBanner() {
	const { t } = useTranslation();
	useGroupMembership();

	const auth = getAuthState();
	if (!auth || (auth.groups.length ?? 0) > 0) return null;

	return (
		<Alert type="info" header={t("awsug.pendingApproval.header")}>
			{t("awsug.pendingApproval.body")}
			<br />
			{t("awsug.pendingApproval.noRelogin")}
		</Alert>
	);
}

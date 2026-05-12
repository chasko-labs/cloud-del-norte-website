// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import { useEffect } from "react";
import { getAuthState, refreshTokens } from "./auth";

const POLL_MS = 60_000;

/**
 * Side-effect hook: polls silent token refresh every 60 s while the user has
 * no Cognito group membership. When groups transition from empty to non-empty,
 * triggers a hard page reload so all React state re-initialises from fresh
 * auth. No-ops immediately if the user already has groups at mount.
 * Refresh failures are swallowed — they must NOT trigger the session-expired modal.
 */
export function useGroupMembership(): void {
	useEffect(() => {
		const initialHasGroups = (getAuthState()?.groups.length ?? 0) > 0;
		if (initialHasGroups) return;

		async function tryRefresh() {
			try {
				await refreshTokens();
				const now = getAuthState();
				const nowHasGroups = (now?.groups.length ?? 0) > 0;
				if (!initialHasGroups && nowHasGroups) {
					window.location.reload();
				}
			} catch {
				// fire-and-forget: keep current state on failure
			}
		}

		void tryRefresh();

		const id = setInterval(() => {
			void tryRefresh();
		}, POLL_MS);

		return () => clearInterval(id);
	}, []);
}

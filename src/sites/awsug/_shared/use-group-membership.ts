// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import { useEffect, useState } from "react";
import { getAuthState, refreshTokens } from "./auth";

const POLL_MS = 60_000;

/**
 * Returns whether the current user has any Cognito group membership.
 * While groups is empty, polls a silent token refresh every 60 s.
 * Stops polling once groups become non-empty.
 * Refresh failures are swallowed — they must NOT trigger the session-expired modal.
 */
export function useGroupMembership(): boolean {
	const [hasGroups, setHasGroups] = useState(() => {
		const state = getAuthState();
		return state !== null && state.groups.length > 0;
	});

	useEffect(() => {
		if (hasGroups) return;

		async function tryRefresh() {
			try {
				await refreshTokens();
				const state = getAuthState();
				if (state && state.groups.length > 0) {
					setHasGroups(true);
				}
			} catch {
				// fire-and-forget: keep current state on failure
			}
		}

		// Attempt immediately on mount
		void tryRefresh();

		const id = setInterval(() => {
			void tryRefresh();
		}, POLL_MS);

		return () => clearInterval(id);
	}, [hasGroups]);

	return hasGroups;
}

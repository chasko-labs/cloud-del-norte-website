// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
// Handles the cross-origin token handoff from auth.clouddelnorte.org.
// Reads tokens from URL fragment, stores them, strips the fragment, then routes.

import Box from "@cloudscape-design/components/box";
import Spinner from "@cloudscape-design/components/spinner";
import React, { useEffect, useState } from "react";
import {
	getAuthState,
	isBanned,
	storeTokensFromFragment,
} from "../../_shared/auth";

const AUTH_LOGIN = "https://auth.clouddelnorte.org/login/index.html";

export default function App() {
	const [error, setError] = useState("");

	useEffect(() => {
		const fragment = window.location.hash.slice(1);
		// Strip fragment immediately — tokens must not linger in browser history
		history.replaceState(
			null,
			"",
			window.location.pathname + window.location.search,
		);

		if (!fragment) {
			window.location.assign(AUTH_LOGIN);
			return;
		}

		const params = new URLSearchParams(fragment);
		const idToken = params.get("id_token") ?? "";
		const accessToken = params.get("access_token") ?? "";
		const refreshToken = params.get("refresh_token") ?? "";

		if (!idToken || !accessToken) {
			window.location.assign(AUTH_LOGIN);
			return;
		}

		try {
			storeTokensFromFragment(idToken, accessToken, refreshToken);
		} catch {
			setError("Failed to process sign-in tokens. Please try again.");
			return;
		}

		const state = getAuthState();
		if (!state) {
			window.location.assign(AUTH_LOGIN);
			return;
		}

		if (isBanned(state)) {
			window.location.assign("/index.html?status=banned");
			return;
		}

		window.location.assign("/index.html");
	}, []);

	if (error) {
		return (
			<Box padding="xxl" textAlign="center">
				<Box color="text-status-error">{error}</Box>
				<Box margin={{ top: "m" }}>
					<a href={AUTH_LOGIN}>Back to sign in</a>
				</Box>
			</Box>
		);
	}

	return (
		<Box padding="xxl" textAlign="center">
			<Spinner size="large" />
		</Box>
	);
}

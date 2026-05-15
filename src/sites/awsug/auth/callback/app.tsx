// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
// Handles PKCE authorization code callback for the awsug subdomain.
// Used by beginSilentLogin() — prompt=none silent reauth flow.

import Box from "@cloudscape-design/components/box";
import Spinner from "@cloudscape-design/components/spinner";
import { useEffect } from "react";
import { handleCallback } from "../../_shared/auth";

const AUTH_LOGIN = "https://auth.clouddelnorte.org/login/index.html";

export default function App() {
	useEffect(() => {
		(async () => {
			try {
				const { returnTo } = await handleCallback();
				window.location.replace(returnTo || "/");
			} catch (err) {
				const msg = err instanceof Error ? err.message : "";
				// login_required = no Cognito session; redirect to login form.
				// Any other error also falls back to login form.
				if (msg.includes("login_required")) {
					window.location.assign(AUTH_LOGIN);
				} else {
					window.location.assign(AUTH_LOGIN);
				}
			}
		})();
	}, []);

	return (
		<Box padding="xxl" textAlign="center">
			<Spinner size="large" />
		</Box>
	);
}

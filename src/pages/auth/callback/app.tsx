import Alert from "@cloudscape-design/components/alert";
import Box from "@cloudscape-design/components/box";
import Button from "@cloudscape-design/components/button";
import SpaceBetween from "@cloudscape-design/components/space-between";
import Spinner from "@cloudscape-design/components/spinner";
import { useEffect, useState } from "react";
import { AUTH_LOGIN_URL, handleCallback } from "../../../lib/auth";

type Status = "exchanging" | "redirecting" | "error";

export default function App() {
	const [status, setStatus] = useState<Status>("exchanging");
	const [errorMsg, setErrorMsg] = useState<string>("");

	useEffect(() => {
		// Cross-origin token handoff: if fragment contains tokens, store them and
		// forward to awsug to complete the propagation chain.
		const fragment = window.location.hash.slice(1);
		if (fragment?.includes("id_token=")) {
			history.replaceState(
				null,
				"",
				window.location.pathname + window.location.search,
			);
			const params = new URLSearchParams(fragment);
			const idToken = params.get("id_token") ?? "";
			const accessToken = params.get("access_token") ?? "";
			const refreshToken = params.get("refresh_token") ?? "";
			const returnTo = params.get("return_to") ?? "";

			if (idToken && accessToken) {
				sessionStorage.setItem("cdn.idToken", idToken);
				sessionStorage.setItem("cdn.accessToken", accessToken);
				if (refreshToken)
					sessionStorage.setItem("cdn.refreshToken", refreshToken);
				try {
					const payload = JSON.parse(
						atob(idToken.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")),
					);
					if (payload.exp)
						sessionStorage.setItem("cdn.expiresAt", String(payload.exp * 1000));
				} catch {
					/* best effort */
				}

				const awsugFragment = `id_token=${encodeURIComponent(idToken)}&access_token=${encodeURIComponent(accessToken)}&refresh_token=${encodeURIComponent(refreshToken)}&return_to=${encodeURIComponent(returnTo)}`;
				window.location.assign(
					`https://awsug.clouddelnorte.org/auth/redeem/index.html#${awsugFragment}`,
				);
				return;
			}
		}

		let cancelled = false;
		(async () => {
			try {
				const { returnTo } = await handleCallback();
				if (cancelled) return;
				setStatus("redirecting");
				window.location.replace(returnTo || "/");
			} catch (err) {
				if (cancelled) return;
				const msg = err instanceof Error ? err.message : "sign-in failed";
				// login_required is the expected response when prompt=none is used and
				// the user has no active Cognito session. Fall back to the login form.
				if (msg.includes("login_required")) {
					window.location.assign(AUTH_LOGIN_URL);
					return;
				}
				setErrorMsg(msg);
				setStatus("error");
			}
		})();
		return () => {
			cancelled = true;
		};
	}, []);

	if (status === "error") {
		return (
			<Box padding="xxl">
				<Alert type="error" header="sign-in failed">
					<SpaceBetween size="s">
						<Box variant="p">{errorMsg}</Box>
						<SpaceBetween size="xs" direction="horizontal">
							<Button
								variant="primary"
								onClick={() => {
									window.location.assign(AUTH_LOGIN_URL);
								}}
							>
								sign in again
							</Button>
							<Button variant="link" href="/">
								return home
							</Button>
						</SpaceBetween>
					</SpaceBetween>
				</Alert>
			</Box>
		);
	}

	return (
		<Box padding="xxl" textAlign="center">
			<SpaceBetween size="l" alignItems="center">
				<Spinner size="large" />
				<Box variant="p">signing you in…</Box>
			</SpaceBetween>
		</Box>
	);
}

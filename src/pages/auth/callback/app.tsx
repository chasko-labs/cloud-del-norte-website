import Alert from "@cloudscape-design/components/alert";
import Box from "@cloudscape-design/components/box";
import Button from "@cloudscape-design/components/button";
import SpaceBetween from "@cloudscape-design/components/space-between";
import Spinner from "@cloudscape-design/components/spinner";
import { useEffect, useState } from "react";
import { beginLogin, handleCallback } from "../../../lib/auth";

type Status = "exchanging" | "redirecting" | "error";

export default function App() {
	const [status, setStatus] = useState<Status>("exchanging");
	const [errorMsg, setErrorMsg] = useState<string>("");

	useEffect(() => {
		let cancelled = false;
		(async () => {
			try {
				const { returnTo } = await handleCallback();
				if (cancelled) return;
				setStatus("redirecting");
				window.location.replace(returnTo || "/");
			} catch (err) {
				if (cancelled) return;
				setErrorMsg(err instanceof Error ? err.message : "sign-in failed");
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
									void beginLogin("/");
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

import Alert from "@cloudscape-design/components/alert";
import Box from "@cloudscape-design/components/box";
import Button from "@cloudscape-design/components/button";
import SpaceBetween from "@cloudscape-design/components/space-between";
import Spinner from "@cloudscape-design/components/spinner";
import { type ReactNode, useEffect } from "react";
import { useAuth } from "../../hooks/useAuth";
import { beginSilentLogin } from "../../lib/auth";

export interface RequireAuthProps {
	children: ReactNode;
	requireGroup?: string;
	fallback?: ReactNode;
}

export function RequireAuth({
	children,
	requireGroup,
	fallback,
}: RequireAuthProps) {
	const auth = useAuth();

	useEffect(() => {
		if (!auth.isAuthenticated) {
			// Attempt silent reauth via prompt=none. If Cognito has a session the
			// callback will exchange the code and return here. If not, the callback
			// detects login_required and redirects to the login form.
			beginSilentLogin().catch(() => {
				// beginSilentLogin only throws if sessionStorage is unavailable;
				// in that case fall through and show the spinner indefinitely
				// (the user will see the sign-in redirect on next interaction).
			});
		}
	}, [auth.isAuthenticated]);

	if (!auth.isAuthenticated) {
		if (fallback) return <>{fallback}</>;
		return (
			<Box padding="xxl" textAlign="center">
				<SpaceBetween size="l" alignItems="center">
					<Spinner size="large" />
					<Box variant="p">redirecting to sign-in…</Box>
				</SpaceBetween>
			</Box>
		);
	}

	if (requireGroup && !auth.groups.includes(requireGroup)) {
		return (
			<Box padding="xxl">
				<Alert type="warning" header="moderator access required">
					this page requires {requireGroup} group membership.
					<Box padding={{ top: "s" }}>
						<Button onClick={auth.signOut}>sign out</Button>
					</Box>
				</Alert>
			</Box>
		);
	}

	return <>{children}</>;
}

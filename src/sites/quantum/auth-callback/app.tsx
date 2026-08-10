import { useEffect } from "react";

export default function App() {
	useEffect(() => {
		const fragment = window.location.hash.slice(1);
		if (fragment?.includes("id_token=")) {
			const params = new URLSearchParams(fragment);
			const idToken = params.get("id_token") ?? "";
			const accessToken = params.get("access_token") ?? "";
			const refreshToken = params.get("refresh_token") ?? "";
			const returnTo = params.get("return_to") ?? "/register/";

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
					/* malformed JWT — continue with redirect */
				}
			}
			window.location.replace(returnTo);
		} else {
			window.location.replace("/register/");
		}
	}, []);

	return (
		<div style={{ textAlign: "center", padding: "4rem" }}>Redirecting...</div>
	);
}

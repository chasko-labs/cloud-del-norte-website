import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { LocaleProvider } from "../../../contexts/locale-context";
import { decodeToken, getIdToken } from "../../../lib/auth";
import type { Locale } from "../../../utils/locale";
import type { Theme } from "../../../utils/theme";

import "./styles.css";

/* Full CDN SunSvg — animated rays + pulsing gold core */
function SunSvg() {
	return (
		<svg
			className="cdn-svg-sun"
			width="22"
			height="22"
			viewBox="0 0 22 22"
			fill="none"
			xmlns="http://www.w3.org/2000/svg"
			aria-hidden="true"
		>
			<g className="cdn-svg-sun__rays">
				<line x1="11" y1="1.5" x2="11" y2="4.5" />
				<line x1="11" y1="17.5" x2="11" y2="20.5" />
				<line x1="1.5" y1="11" x2="4.5" y2="11" />
				<line x1="17.5" y1="11" x2="20.5" y2="11" />
				<line x1="3.9" y1="3.9" x2="6.0" y2="6.0" />
				<line x1="16.0" y1="16.0" x2="18.1" y2="18.1" />
				<line x1="3.9" y1="18.1" x2="6.0" y2="16.0" />
				<line x1="16.0" y1="6.0" x2="18.1" y2="3.9" />
			</g>
			<circle className="cdn-svg-sun__core" cx="11" cy="11" r="4.4" />
		</svg>
	);
}

/* Full CDN MoonSvg — fat waxing crescent with glow animation */
const MOON_CRESCENT_PATH =
	"M 16.2,3.6 A 8.5,8.5 0 1,0 18.6,15.6 A 6.5,6.5 0 1,1 16.2,3.6 Z";

function MoonSvg() {
	return (
		<svg
			className="cdn-svg-moon"
			width="22"
			height="22"
			viewBox="0 0 22 22"
			fill="none"
			xmlns="http://www.w3.org/2000/svg"
			aria-hidden="true"
		>
			<path className="cdn-svg-moon__disc" d={MOON_CRESCENT_PATH} />
		</svg>
	);
}

function UsFlagIcon() {
	return (
		<svg
			width="24"
			height="16"
			viewBox="0 0 26 18"
			xmlns="http://www.w3.org/2000/svg"
			style={{ borderRadius: 2 }}
			aria-hidden="true"
		>
			<rect x="0" y="0" width="26" height="1.385" fill="#b22234" />
			<rect x="0" y="1.385" width="26" height="1.385" fill="#ffffff" />
			<rect x="0" y="2.77" width="26" height="1.385" fill="#b22234" />
			<rect x="0" y="4.155" width="26" height="1.385" fill="#ffffff" />
			<rect x="0" y="5.54" width="26" height="1.385" fill="#b22234" />
			<rect x="0" y="6.925" width="26" height="1.385" fill="#ffffff" />
			<rect x="0" y="8.31" width="26" height="1.385" fill="#b22234" />
			<rect x="0" y="9.695" width="26" height="1.385" fill="#ffffff" />
			<rect x="0" y="11.08" width="26" height="1.385" fill="#b22234" />
			<rect x="0" y="12.465" width="26" height="1.385" fill="#ffffff" />
			<rect x="0" y="13.85" width="26" height="1.385" fill="#b22234" />
			<rect x="0" y="15.235" width="26" height="1.385" fill="#ffffff" />
			<rect x="0" y="16.62" width="26" height="1.385" fill="#b22234" />
			<rect x="0" y="0" width="10.4" height="9.695" fill="#3c3b6e" />
		</svg>
	);
}

function MxFlagIcon() {
	return (
		<svg
			width="24"
			height="16"
			viewBox="0 0 26 18"
			xmlns="http://www.w3.org/2000/svg"
			style={{ borderRadius: 2 }}
			aria-hidden="true"
		>
			<rect x="0" y="0" width="8.667" height="18" fill="#006847" />
			<rect x="8.667" y="0" width="8.666" height="18" fill="#ffffff" />
			<rect x="17.333" y="0" width="8.667" height="18" fill="#ce1126" />
		</svg>
	);
}

const AUTH_SIGN_IN_URL =
	"https://auth.clouddelnorte.org/login/index.html?returnTo=https://quantum.clouddelnorte.org/dashboard/";

type UserState =
	| { kind: "authenticated"; displayName: string }
	| { kind: "registered" }
	| { kind: "guest" };

function resolveUserState(): UserState {
	const idToken = getIdToken();
	if (idToken) {
		try {
			const payload = decodeToken(idToken);
			const name =
				(payload["custom:display_name"] as string) ??
				(payload.name as string) ??
				(payload.email as string) ??
				"User";
			return { kind: "authenticated", displayName: name };
		} catch {
			// token decode failure — treat as guest
		}
	}
	try {
		if (localStorage.getItem("cdn-quantum-registered") !== null) {
			return { kind: "registered" };
		}
	} catch {
		// localStorage unavailable
	}
	return { kind: "guest" };
}

function handleSignOut(): void {
	sessionStorage.removeItem("cdn.idToken");
	sessionStorage.removeItem("cdn.accessToken");
	sessionStorage.removeItem("cdn.refreshToken");
	sessionStorage.removeItem("cdn.expiresAt");
	sessionStorage.removeItem("cdn.loginState");
	try {
		localStorage.removeItem("cdn-quantum-registered");
		localStorage.removeItem("cdn-quantum-celebration-shown");
		localStorage.removeItem("cdn-quantum-passkey-dismissed");
	} catch {
		// non-critical
	}
	window.location.reload();
}

function UserIdentity() {
	const [state, setState] = useState<UserState>({ kind: "guest" });

	useEffect(() => {
		setState(resolveUserState());
	}, []);

	if (state.kind === "authenticated") {
		const truncated =
			state.displayName.length > 20
				? `${state.displayName.slice(0, 18)}…`
				: state.displayName;
		return (
			<span className="quantum-user quantum-user--authed">
				<span className="quantum-user__name" title={state.displayName}>
					{truncated}
				</span>
				<button
					type="button"
					className="quantum-user__signout"
					onClick={handleSignOut}
				>
					Sign out
				</button>
			</span>
		);
	}

	if (state.kind === "registered") {
		return (
			<span className="quantum-user quantum-user--registered">
				✓ Registered
			</span>
		);
	}

	return (
		<a href={AUTH_SIGN_IN_URL} className="quantum-user quantum-user--guest">
			Sign in
		</a>
	);
}

interface QuantumLayoutProps {
	children: ReactNode;
	theme: Theme;
	onThemeChange: (theme: Theme) => void;
	locale: Locale;
	onLocaleChange: (locale: Locale) => void;
}

export default function QuantumLayout({
	children,
	theme,
	onThemeChange,
	locale,
	onLocaleChange,
}: QuantumLayoutProps) {
	return (
		<LocaleProvider locale={locale}>
			<div className="quantum-layout">
				<header className="quantum-toolbar">
					<a
						href="https://quantum.clouddelnorte.org"
						className="quantum-toolbar__brand"
					>
						quantum computing workshop series
					</a>
					<div className="quantum-toolbar__controls">
						<button
							type="button"
							className="quantum-pill quantum-pill--celestial"
							onClick={() => onThemeChange(theme === "dark" ? "light" : "dark")}
							aria-label={
								theme === "dark"
									? "Switch to light mode"
									: "Switch to dark mode"
							}
						>
							{theme === "dark" ? <SunSvg /> : <MoonSvg />}
						</button>
						<button
							type="button"
							className="quantum-pill"
							onClick={() => onLocaleChange(locale === "us" ? "mx" : "us")}
							aria-label={
								locale === "us" ? "Cambiar a español" : "Switch to English"
							}
						>
							{locale === "us" ? <MxFlagIcon /> : <UsFlagIcon />}
						</button>
						<UserIdentity />
					</div>
				</header>
				<main className="quantum-main">{children}</main>
			</div>
		</LocaleProvider>
	);
}

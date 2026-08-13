// QUANTUM FLOW MANDATE: users must never exit quantum and land stranded in the UG system.
// Every external link either carries ?return_to= back to /auth-callback/#return_to=<quantum-path>
// or opens in a new tab (target="_blank") so the quantum tab persists.

import Alert from "@cloudscape-design/components/alert";
import Box from "@cloudscape-design/components/box";
import Button from "@cloudscape-design/components/button";
import Container from "@cloudscape-design/components/container";
import FormField from "@cloudscape-design/components/form-field";
import Header from "@cloudscape-design/components/header";
import Input from "@cloudscape-design/components/input";
import Link from "@cloudscape-design/components/link";
import Select from "@cloudscape-design/components/select";
import SpaceBetween from "@cloudscape-design/components/space-between";
import { useEffect, useState } from "react";
import { useTranslation } from "../../../hooks/useTranslation";
import { addRsvp } from "../../../lib/rsvp";
import {
	applyLocale,
	initializeLocale,
	type Locale,
	setStoredLocale,
} from "../../../utils/locale";
import {
	applyTheme,
	initializeTheme,
	setStoredTheme,
	type Theme,
} from "../../../utils/theme";
import QuantumLayout from "../_layout";

const RSVP_API = "https://tta0e43bs0.execute-api.us-west-2.amazonaws.com/prod";

const QUANTUM_EVENT_ID = "quantum-superpositions-2026-08-30";

const GOOGLE_CALENDAR_URL =
	"https://calendar.google.com/calendar/render?action=TEMPLATE&text=Quantum+Computing+Workshop+-+Amazon+Braket&dates=20260830T210000Z/20260831T000000Z&details=Hands-on+Amazon+Braket+workshop.+quantum.clouddelnorte.org&location=Online+(quantum.clouddelnorte.org)";

const GROUP_OPTIONS = [
	{
		value: "cloud-del-norte",
		label: "Cloud Del Norte (El Paso / NM / Chihuahua)",
	},
	{ value: "clarksville", label: "AWS UG Clarksville" },
	{ value: "columbia", label: "Columbia AWS Users Group" },
	{ value: "other", label: "Another AWS User Group" },
	{ value: "none", label: "Not part of a group yet" },
];

interface AuthUser {
	email: string;
	name: string;
}

function decodeIdToken(): AuthUser | null {
	const idToken = sessionStorage.getItem("cdn.idToken");
	if (!idToken) return null;
	try {
		const payload = JSON.parse(
			atob(idToken.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")),
		);
		const expiresAt = Number(sessionStorage.getItem("cdn.expiresAt") ?? "0");
		if (expiresAt && Date.now() > expiresAt) return null;
		return {
			email: payload.email ?? "",
			name:
				payload["custom:display_name"] ??
				payload.name ??
				payload.email?.split("@")[0] ??
				"",
		};
	} catch {
		return null;
	}
}

function MemberRsvp({ user }: { user: AuthUser }) {
	const { t } = useTranslation();
	const [loading, setLoading] = useState(false);
	const [confirmed, setConfirmed] = useState(false);
	const [error, setError] = useState("");

	const handleConfirm = async () => {
		setLoading(true);
		setError("");
		try {
			await addRsvp({
				eventId: QUANTUM_EVENT_ID,
				name: user.name,
				email: user.email,
			});
			setConfirmed(true);
			localStorage.setItem(
				"cdn-quantum-registered",
				JSON.stringify({ email: user.email, date: new Date().toISOString() }),
			);
		} catch (e) {
			const msg = e instanceof Error ? e.message : "";
			if (msg === "capacity_full") {
				setError(t("quantumRegister.capacityFullError"));
			} else {
				setError(t("quantumRegister.genericError"));
			}
		} finally {
			setLoading(false);
		}
	};

	if (confirmed) {
		return (
			<Container>
				<div style={{ textAlign: "center", padding: "2rem 0" }}>
					<div className="quantum-success-pulse">
						<svg
							width="64"
							height="64"
							viewBox="0 0 64 64"
							fill="none"
							aria-hidden="true"
						>
							<circle
								cx="32"
								cy="32"
								r="30"
								stroke="#9060f0"
								strokeWidth="2"
								opacity="0.3"
							/>
							<circle cx="32" cy="32" r="24" fill="rgba(144,96,240,0.1)" />
							<path
								d="M20 32 L28 40 L44 24"
								stroke="#9060f0"
								strokeWidth="3"
								strokeLinecap="round"
								strokeLinejoin="round"
								fill="none"
							/>
						</svg>
					</div>
					<SpaceBetween size="m">
						<Header variant="h1">
							{t("quantumRegister.memberAlreadyRegistered")}
						</Header>
						<Box color="text-body-secondary">
							{t("quantumRegister.memberSubtext").replace(
								"{{email}}",
								user.email,
							)}
						</Box>
						<Button
							variant="primary"
							href={GOOGLE_CALENDAR_URL}
							target="_blank"
							iconName="external"
						>
							{t("quantumRegister.addToCalendar")}
						</Button>
						<Link href="/?registered=quantum-workshop">
							{t("quantumRegister.backLink")}
						</Link>
					</SpaceBetween>
				</div>
			</Container>
		);
	}

	return (
		<Container>
			<div style={{ textAlign: "center", padding: "2rem 0" }}>
				<SpaceBetween size="l">
					<Header variant="h1">
						{t("quantumRegister.memberWelcome").replace("{{name}}", user.name)}
					</Header>
					<Box color="text-body-secondary" fontSize="heading-s">
						Sun Aug 30 · 3:00–6:00 PM CDT
					</Box>
					{error && <Alert type="error">{error}</Alert>}
					<Button variant="primary" loading={loading} onClick={handleConfirm}>
						{t("quantumRegister.memberConfirmRsvp")}
					</Button>
					<Button
						variant="link"
						href={GOOGLE_CALENDAR_URL}
						target="_blank"
						iconName="external"
					>
						{t("quantumRegister.addToCalendar")}
					</Button>
				</SpaceBetween>
			</div>
		</Container>
	);
}

function RegisterForm() {
	const { t } = useTranslation();
	const [user, setUser] = useState<AuthUser | null>(null);
	const [email, setEmail] = useState("");
	const [name, setName] = useState("");
	const [group, setGroup] = useState<{
		value: string;
		label: string;
	} | null>(null);
	const [loading, setLoading] = useState(false);
	const [success, setSuccess] = useState(false);
	const [error, setError] = useState("");

	useEffect(() => {
		setUser(decodeIdToken());
	}, []);

	if (user) {
		return <MemberRsvp user={user} />;
	}

	const handleSubmit = async () => {
		if (!email || !name) {
			setError(t("quantumRegister.validationError"));
			return;
		}
		setLoading(true);
		setError("");
		try {
			const res = await fetch(`${RSVP_API}/rsvp`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					eventId: QUANTUM_EVENT_ID,
					name,
					email,
					group: group?.value ?? null,
				}),
			});
			if (!res.ok) {
				const body = (await res.json().catch(() => ({}))) as { error?: string };
				if (res.status === 401) {
					throw new Error("auth_required");
				}
				if (res.status === 409) {
					throw new Error("capacity_full");
				}
				throw new Error(body.error ?? "generic");
			}
			setSuccess(true);
			localStorage.setItem(
				"cdn-quantum-registered",
				JSON.stringify({ email, date: new Date().toISOString() }),
			);
		} catch (e) {
			const msg = e instanceof Error ? e.message : "";
			if (msg === "auth_required") {
				setError(t("quantumRegister.authRequiredError"));
			} else if (msg === "capacity_full") {
				setError(t("quantumRegister.capacityFullError"));
			} else {
				setError(t("quantumRegister.genericError"));
			}
		} finally {
			setLoading(false);
		}
	};

	if (success) {
		return (
			<Container>
				<div style={{ textAlign: "center", padding: "2rem 0" }}>
					<div className="quantum-success-pulse">
						<svg
							width="64"
							height="64"
							viewBox="0 0 64 64"
							fill="none"
							aria-hidden="true"
						>
							<circle
								cx="32"
								cy="32"
								r="30"
								stroke="#9060f0"
								strokeWidth="2"
								opacity="0.3"
							/>
							<circle cx="32" cy="32" r="24" fill="rgba(144,96,240,0.1)" />
							<path
								d="M20 32 L28 40 L44 24"
								stroke="#9060f0"
								strokeWidth="3"
								strokeLinecap="round"
								strokeLinejoin="round"
								fill="none"
							/>
						</svg>
					</div>
					<Header variant="h1">{t("quantumRegister.successHeader")}</Header>
					<SpaceBetween size="m">
						<Alert type="success" header={t("quantumRegister.successHeader")}>
							{t("quantumRegister.successBody")}
						</Alert>
						<Box fontSize="heading-s" fontWeight="bold">
							Sun Aug 30 · 3:00–6:00 PM CDT
						</Box>
						<Box fontWeight="bold">{t("quantumRegister.successNextSteps")}</Box>
						<Box>{t("quantumRegister.successBookmark")}</Box>
						<Button variant="primary" href="/dashboard/">
							{t("quantumDashboard.goToDashboard")}
						</Button>
						<Link href="/?registered=quantum-workshop">
							{t("quantumRegister.backLink")}
						</Link>
					</SpaceBetween>
				</div>
			</Container>
		);
	}

	return (
		<SpaceBetween size="xl">
			<Container
				header={<Header variant="h1">{t("quantumRegister.header")}</Header>}
			>
				<SpaceBetween size="m">
					<Box color="text-body-secondary">{t("quantumRegister.subtitle")}</Box>
					{error && <Alert type="error">{error}</Alert>}
					<FormField
						label={t("quantumRegister.emailLabel")}
						constraintText={t("quantumRegister.emailHint")}
					>
						<Input
							value={email}
							onChange={({ detail }) => setEmail(detail.value)}
							placeholder="you@example.com"
							type="email"
						/>
					</FormField>
					<FormField
						label={t("quantumRegister.nameLabel")}
						constraintText={t("quantumRegister.nameHint")}
					>
						<Input
							value={name}
							onChange={({ detail }) => setName(detail.value)}
							placeholder="e.g. Alex"
						/>
					</FormField>
					<FormField
						label={t("quantumRegister.groupLabel")}
						constraintText={t("quantumRegister.groupHint")}
					>
						<Select
							selectedOption={group}
							onChange={({ detail }) =>
								setGroup(
									detail.selectedOption as {
										value: string;
										label: string;
									} | null,
								)
							}
							options={GROUP_OPTIONS}
							placeholder="Select a group (optional)"
						/>
					</FormField>
					<Button variant="primary" loading={loading} onClick={handleSubmit}>
						{t("quantumRegister.submitButton")}
					</Button>
				</SpaceBetween>
			</Container>

			<Box textAlign="center" color="text-body-secondary" fontSize="body-s">
				<SpaceBetween size="xs">
					<Box>{t("quantumRegister.communityAccess")}</Box>
					<Box>
						<Link href="https://auth.clouddelnorte.org/signup/index.html?return_to=https://quantum.clouddelnorte.org/auth-callback/%23return_to=/dashboard/">
							{t("quantumRegister.joinCdn")}
						</Link>
						{" · "}
						<Link
							href="https://www.meetup.com/pro/global-aws-user-group-community/"
							external
						>
							{t("quantumRegister.findLocal")}
						</Link>
					</Box>
				</SpaceBetween>
			</Box>
		</SpaceBetween>
	);
}

export default function App() {
	const [theme, setTheme] = useState<Theme>(() => initializeTheme());
	const [locale, setLocale] = useState<Locale>(() => initializeLocale());

	const handleThemeChange = (newTheme: Theme) => {
		setTheme(newTheme);
		applyTheme(newTheme);
		setStoredTheme(newTheme);
	};
	const handleLocaleChange = (newLocale: Locale) => {
		setLocale(newLocale);
		applyLocale(newLocale);
		setStoredLocale(newLocale);
	};

	return (
		<QuantumLayout
			theme={theme}
			onThemeChange={handleThemeChange}
			locale={locale}
			onLocaleChange={handleLocaleChange}
		>
			<RegisterForm />
		</QuantumLayout>
	);
}

import Box from "@cloudscape-design/components/box";
import Button from "@cloudscape-design/components/button";
import Container from "@cloudscape-design/components/container";
import Header from "@cloudscape-design/components/header";
import Link from "@cloudscape-design/components/link";
import SpaceBetween from "@cloudscape-design/components/space-between";
import { useState } from "react";
import { LocaleProvider } from "../../../contexts/locale-context";
import Shell from "../../../layouts/shell";
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

const SIGNUP_QUANTUM_URL =
	"https://auth.clouddelnorte.org/signup/index.html?event=quantum";
const SIGNUP_URL = "https://auth.clouddelnorte.org/signup/index.html";
const LOGIN_URL = "https://auth.clouddelnorte.org/login/index.html";

function RegisterContent() {
	return (
		<SpaceBetween size="xl">
			<Header variant="h1">Register</Header>

			{/* Card 1: Workshop registration */}
			<Container
				header={
					<Header
						variant="h2"
						description="Get meeting access and on-demand recordings"
					>
						Quantum Computing Workshop Series
					</Header>
				}
			>
				<SpaceBetween size="m">
					<Box fontSize="body-m">
						Register for the meeting and get on-demand access to the Quantum
						Computing Workshop Series. Includes live participation in the Aug 30
						hands-on Amazon Braket session.
					</Box>
					<Button variant="primary" href={SIGNUP_QUANTUM_URL}>
						Register for Workshop
					</Button>
				</SpaceBetween>
			</Container>

			{/* Card 2: General membership */}
			<Container
				header={
					<Header
						variant="h2"
						description="AWS User Group serving Far West Texas, New Mexico & Chihuahua, Mexico"
					>
						Join Cloud Del Norte
					</Header>
				}
			>
				<SpaceBetween size="m">
					<Box fontSize="body-m">
						Join the community for all meetings, workshops, and member
						resources. Access to the quantum workshop is included with
						membership.
					</Box>
					<Button variant="normal" href={SIGNUP_URL}>
						Join Cloud Del Norte
					</Button>
				</SpaceBetween>
			</Container>

			{/* Footer: existing account */}
			<Box textAlign="center" color="text-body-secondary" fontSize="body-s">
				Already have a Cloud Del Norte account?{" "}
				<Link href={LOGIN_URL}>Sign in</Link>
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
		<LocaleProvider locale={locale}>
			<Shell
				theme={theme}
				onThemeChange={handleThemeChange}
				locale={locale}
				onLocaleChange={handleLocaleChange}
				navigationHide
				toolsHide
				identityHref="https://clouddelnorte.org"
			>
				<RegisterContent />
			</Shell>
		</LocaleProvider>
	);
}

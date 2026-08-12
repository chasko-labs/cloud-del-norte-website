import Box from "@cloudscape-design/components/box";
import Container from "@cloudscape-design/components/container";
import Grid from "@cloudscape-design/components/grid";
import Header from "@cloudscape-design/components/header";
import Link from "@cloudscape-design/components/link";
import SpaceBetween from "@cloudscape-design/components/space-between";
import { useEffect, useState } from "react";
import CalendarActions from "../../../components/calendar-actions";
import { useTranslation } from "../../../hooks/useTranslation";
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
import "./landing.css";

const CHRISTIAN_AVATAR =
	"https://avatars.builderprofile.aws.dev/33kByuRaGaQfqwc41T52Ws9w4v1.webp";
const CHRISTIAN_PROFILE = "https://builder.aws.com/community/@chrisgrey0321";
const AMELIA_AVATAR =
	"https://avatars.builderprofile.aws.dev/2baMniGqrdbQ0xOBEPgtgiGkWsX.webp";
const AMELIA_PROFILE = "https://builder.aws.com/community/@ameliahr";
const BRYAN_AVATAR =
	"https://avatars.builderprofile.aws.dev/2pBt75Hl5Kze3KoYvJXCh8fDel1.webp";
const BRYAN_PROFILE = "https://builder.aws.com/community/@bryanchasko";
const BRAKET_URL =
	"https://builder.aws.com/content/3GaxVTZeaL9pWzjXj3k7tMynzbI/a-developers-field-guide-to-amazon-braket";
const REGISTER_URL = "/register/";
const DASHBOARD_URL = "/dashboard/";
const GLOBAL_UG_URL =
	"https://www.meetup.com/pro/global-aws-user-group-community/";

const MEETUP_GROUPS = [
	{
		name: "AWS UG Cloud Del Norte",
		url: "https://www.meetup.com/awsugclouddelnorte/",
		location: "El Paso, TX",
	},
	{
		name: "AWS User Group Clarksville",
		url: "https://www.meetup.com/aws-user-group-clarksville/",
		location: "Clarksville, TN",
	},
	{
		name: "Columbia AWS Users Group",
		url: "https://www.meetup.com/columbia-aws-users-group/",
		location: "Columbia, SC",
	},
];

/* Meetup logo mark — simplified M in rounded square, brand red #ED1C40 */
function MeetupLogo({ size = 20 }: { size?: number }) {
	return (
		<svg
			width={size}
			height={size}
			viewBox="0 0 24 24"
			fill="none"
			xmlns="http://www.w3.org/2000/svg"
			aria-label="Meetup"
			role="img"
		>
			<rect width="24" height="24" rx="4" fill="#ED1C40" />
			<path
				d="M6.5 16.5c.3.5.8.7 1.3.5.5-.2.7-.7.6-1.2l-.8-4.2c-.2-.8.4-1.5 1.2-1.5.6 0 1.1.4 1.2 1l.9 4.1c.1.5.6.9 1.1.8.5-.1.9-.6.8-1.1l-.9-4.3c-.1-.8.4-1.5 1.2-1.5.6 0 1.1.4 1.2 1l1 4.5c.1.5.6.8 1.1.7.5-.1.9-.6.7-1.1l-1.4-5.8c-.3-1.3-1.5-2.2-2.8-2.1-1 .1-1.8.6-2.2 1.4-.5-.6-1.3-.9-2.1-.8-1.3.2-2.3 1.3-2.2 2.7l.6 5c.1.6.3 1.1.5 1.4z"
				fill="white"
			/>
		</svg>
	);
}

function isLoggedIn(): boolean {
	const idToken = sessionStorage.getItem("cdn.idToken");
	if (!idToken) return false;
	const expiresAt = Number(sessionStorage.getItem("cdn.expiresAt") ?? "0");
	return expiresAt > 0 && Date.now() < expiresAt;
}

function isRegistered(): boolean {
	try {
		return localStorage.getItem("cdn-quantum-registered") !== null;
	} catch {
		return false;
	}
}

function LandingContent() {
	const { t } = useTranslation();
	const [loggedIn, setLoggedIn] = useState(false);
	const [registered, setRegistered] = useState(false);

	useEffect(() => {
		setLoggedIn(isLoggedIn());
		setRegistered(isRegistered());
	}, []);

	return (
		<SpaceBetween size="xl">
			{/* CTA 1: Sign in — small, understated, implies returning visitors */}
			<Box textAlign="right">
				{loggedIn || registered ? (
					<Link href={DASHBOARD_URL} fontSize="body-s">
						{t("quantum.goToDashboard")}
					</Link>
				) : (
					<Link href={DASHBOARD_URL} fontSize="body-s">
						{t("quantum.signIn")}
					</Link>
				)}
			</Box>

			{/* Hero */}
			<Container>
				<SpaceBetween size="m">
					<Box variant="small" color="text-status-info">
						{t("quantum.badge")}
					</Box>
					<Header variant="h1">
						{t("quantum.title").replace("Amazon Braket", "")}{" "}
						<Link href={BRAKET_URL} external fontSize="heading-xl">
							Amazon Braket
						</Link>{" "}
					</Header>
					<Box color="text-body-secondary" fontSize="heading-s">
						{t("quantum.subtitle")}
					</Box>
					<Box fontSize="body-m">{t("quantum.date")}</Box>
					<Box fontSize="body-s" color="text-body-secondary">
						{t("quantum.bilingual")}
					</Box>

					{/* CTA 2: Register — PRIMARY, most prominent, animated */}
					<div className="quantum-register-cta-wrapper">
						<a
							href={registered || loggedIn ? DASHBOARD_URL : REGISTER_URL}
							className="quantum-register-cta"
							data-tool-name="register_for_workshop"
							data-tool-description="Register for the quantum computing workshop on Amazon Braket, August 30 2026"
						>
							<span className="quantum-register-cta__text">
								{registered || loggedIn
									? t("quantum.goToDashboard")
									: t("quantum.registerButton")}
							</span>
							<span
								className="quantum-register-cta__shimmer"
								aria-hidden="true"
							/>
						</a>
					</div>
					<CalendarActions />
				</SpaceBetween>
			</Container>

			{/* Digital Badge Section */}
			<Container
				header={
					<Header variant="h2" description={t("quantum.badgeSectionNoCost")}>
						{t("quantum.badgeSectionHeader")}
					</Header>
				}
			>
				<SpaceBetween size="m">
					<Grid gridDefinition={[{ colspan: 2 }, { colspan: 10 }]}>
						<Box textAlign="center" padding={{ top: "s" }}>
							<svg
								width="64"
								height="64"
								viewBox="0 0 64 64"
								fill="none"
								xmlns="http://www.w3.org/2000/svg"
								aria-label="Digital badge"
								role="img"
							>
								<path
									d="M32 4L40 20H56L44 32L48 48L32 40L16 48L20 32L8 20H24L32 4Z"
									fill="#c9a23f"
									opacity="0.9"
								/>
								<circle cx="32" cy="28" r="10" fill="#1a0a2e" />
								<path
									d="M28 28L31 31L37 25"
									stroke="#c9a23f"
									strokeWidth="2.5"
									strokeLinecap="round"
									strokeLinejoin="round"
								/>
								<path
									d="M24 48L28 56L32 50L36 56L40 48"
									fill="#c9a23f"
									opacity="0.7"
								/>
							</svg>
						</Box>
						<SpaceBetween size="s">
							<Box fontSize="body-m">{t("quantum.badgeSectionIntro")}</Box>
							<Box fontSize="body-m">
								<ul style={{ margin: 0, paddingLeft: "1.2rem" }}>
									<li>{t("quantum.badgeSectionStep1")}</li>
									<li>{t("quantum.badgeSectionStep2")}</li>
									<li>{t("quantum.badgeSectionStep3")}</li>
								</ul>
							</Box>
							<Box fontSize="body-s" color="text-body-secondary">
								{t("quantum.badgeSectionCourses")}
							</Box>
							<SpaceBetween size="xs" direction="horizontal">
								<Link
									href="https://aws.amazon.com/blogs/quantum-computing/introducing-the-amazon-braket-learning-plan-and-digital-badge/"
									external
								>
									{t("quantum.badgeSectionBlogLink")}
								</Link>
								<Link
									href="https://explore.skillbuilder.aws/learn/learning_plan/view/2252/amazon-braket-badge-readiness-path"
									external
								>
									{t("quantum.badgeSectionSkillBuilderLink")}
								</Link>
							</SpaceBetween>
						</SpaceBetween>
					</Grid>
				</SpaceBetween>
			</Container>

			{/* Description */}
			<Container
				header={<Header variant="h2">{t("quantum.descriptionHeader")}</Header>}
			>
				<Box fontSize="body-m">{t("quantum.description")}</Box>
			</Container>

			{/* Hosts / Speakers */}
			<Container
				header={<Header variant="h2">{t("quantum.hostsHeader")}</Header>}
			>
				<Grid gridDefinition={[{ colspan: 4 }, { colspan: 4 }, { colspan: 4 }]}>
					<SpaceBetween size="xs" alignItems="center">
						<div style={{ position: "relative", display: "inline-block" }}>
							<img
								src={CHRISTIAN_AVATAR}
								alt="Christian Perez"
								style={{
									width: 100,
									height: 100,
									borderRadius: "50%",
									border: "3px solid #c9a23f",
									boxShadow: "0 0 20px rgba(201,162,63,0.3)",
								}}
							/>
							<span
								style={{
									position: "absolute",
									top: "-4px",
									right: "-4px",
									background: "linear-gradient(135deg,#c9a23f,#daa520)",
									color: "#1a0a00",
									fontSize: "0.6rem",
									fontWeight: 800,
									padding: "2px 8px",
									borderRadius: "4px",
									letterSpacing: "0.05em",
								}}
							>
								{t("quantum.hostBadge")}
							</span>
						</div>
						<Box fontWeight="bold" fontSize="heading-s">
							<Link href={CHRISTIAN_PROFILE} external>
								Christian Perez
							</Link>
						</Box>
						<Box color="text-body-secondary" fontSize="body-s">
							{t("quantum.christianTitle")}
						</Box>
						<Box
							color="text-body-secondary"
							fontSize="body-s"
							textAlign="center"
						>
							{t("quantum.christianBio")}
						</Box>
					</SpaceBetween>
					<SpaceBetween size="xs" alignItems="center">
						<img
							src={AMELIA_AVATAR}
							alt="Amelia Hough-Ross"
							style={{ width: 80, height: 80, borderRadius: "50%" }}
						/>
						<Box fontWeight="bold">
							<Link href={AMELIA_PROFILE} external>
								Amelia Hough-Ross
							</Link>
						</Box>
						<Box color="text-body-secondary" fontSize="body-s">
							{t("quantum.ameliaTitle")}
						</Box>
					</SpaceBetween>
					<SpaceBetween size="xs" alignItems="center">
						<img
							src={BRYAN_AVATAR}
							alt="Bryan Chasko"
							style={{ width: 80, height: 80, borderRadius: "50%" }}
						/>
						<Box fontWeight="bold">
							<Link href={BRYAN_PROFILE} external>
								Bryan Chasko
							</Link>
						</Box>
						<Box color="text-body-secondary" fontSize="body-s">
							{t("quantum.bryanTitle")}
						</Box>
					</SpaceBetween>
				</Grid>
			</Container>

			{/* CTA 3: Meetup groups — "Run by AWS communities" */}
			<Container
				header={<Header variant="h2">{t("quantum.groupsHeader")}</Header>}
			>
				<SpaceBetween size="m">
					{MEETUP_GROUPS.map((group) => (
						<div key={group.url} className="quantum-meetup-group">
							<MeetupLogo size={22} />
							<div className="quantum-meetup-group__info">
								<a
									href={group.url}
									target="_blank"
									rel="noopener noreferrer"
									className="quantum-meetup-group__name"
								>
									{group.name}
								</a>
								<span className="quantum-meetup-group__location">
									{group.location}
								</span>
							</div>
							<a
								href={group.url}
								target="_blank"
								rel="noopener noreferrer"
								className="quantum-meetup-group__rsvp"
							>
								{t("quantum.rsvpMeetup")}
							</a>
						</div>
					))}
					<Box fontSize="body-s" color="text-body-secondary">
						<Link href={GLOBAL_UG_URL} external>
							{t("quantum.findLocal")}
						</Link>
					</Box>
				</SpaceBetween>
			</Container>

			{/* Footer CTA — register repeat */}
			<Box textAlign="center">
				<div className="quantum-register-cta-wrapper quantum-register-cta-wrapper--footer">
					<a
						href={loggedIn || registered ? DASHBOARD_URL : REGISTER_URL}
						className="quantum-register-cta"
					>
						<span className="quantum-register-cta__text">
							{loggedIn || registered
								? t("quantum.goToDashboard")
								: t("quantum.registerButton")}
						</span>
						<span
							className="quantum-register-cta__shimmer"
							aria-hidden="true"
						/>
					</a>
				</div>
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
			<LandingContent />
		</QuantumLayout>
	);
}

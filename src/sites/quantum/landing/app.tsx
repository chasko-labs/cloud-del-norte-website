import Box from "@cloudscape-design/components/box";
import Button from "@cloudscape-design/components/button";
import Container from "@cloudscape-design/components/container";
import Grid from "@cloudscape-design/components/grid";
import Header from "@cloudscape-design/components/header";
import Link from "@cloudscape-design/components/link";
import SpaceBetween from "@cloudscape-design/components/space-between";
import { useState } from "react";
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
const REGISTER_URL = "/register/index.html";
const MEETUP_URL = "https://www.meetup.com/awsugclouddelnorte/";
const GLOBAL_UG_URL =
	"https://www.meetup.com/pro/global-aws-user-group-community/";

function LandingContent() {
	const { t } = useTranslation();

	return (
		<SpaceBetween size="xl">
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
					<SpaceBetween size="xs" direction="horizontal">
						<Button variant="primary" href={REGISTER_URL}>
							{t("quantum.registerButton")}
						</Button>
						<Button variant="link" href={MEETUP_URL} target="_blank">
							{t("quantum.rsvpMeetup")}
						</Button>
					</SpaceBetween>
				</SpaceBetween>
			</Container>

			{/* Description */}
			<Container
				header={<Header variant="h2">{t("quantum.descriptionHeader")}</Header>}
			>
				<Box fontSize="body-m">{t("quantum.description")}</Box>
			</Container>

			{/* Hosts */}
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

			{/* Hosting */}
			<Container
				header={<Header variant="h2">{t("quantum.groupsHeader")}</Header>}
			>
				<SpaceBetween size="s">
					<Box fontWeight="bold">AWS User Group Clarksville</Box>
					<Box fontWeight="bold">Columbia AWS User Group</Box>
					<Box fontWeight="bold">AWS SBG at University of South Carolina</Box>
					<Box fontWeight="bold">Cloud Del Norte</Box>
					<Link href={GLOBAL_UG_URL} external>
						{t("quantum.findLocal")}
					</Link>
				</SpaceBetween>
			</Container>

			{/* Footer CTA */}
			<Box textAlign="center">
				<Button variant="primary" href={REGISTER_URL}>
					{t("quantum.registerButton")}
				</Button>
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

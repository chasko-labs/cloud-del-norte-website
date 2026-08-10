import Box from "@cloudscape-design/components/box";
import Button from "@cloudscape-design/components/button";
import Container from "@cloudscape-design/components/container";
import Grid from "@cloudscape-design/components/grid";
import Header from "@cloudscape-design/components/header";
import Link from "@cloudscape-design/components/link";
import SpaceBetween from "@cloudscape-design/components/space-between";
import { useState } from "react";
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
	return (
		<SpaceBetween size="xl">
			{/* Hero */}
			<Container>
				<SpaceBetween size="m">
					<Box variant="small" color="text-status-info">
						LIVE AWS WEBINAR · FREE
					</Box>
					<Header variant="h1">
						Hands-On{" "}
						<Link href={BRAKET_URL} external fontSize="heading-xl">
							Amazon Braket
						</Link>{" "}
						Workshop
					</Header>
					<Box color="text-body-secondary" fontSize="heading-s">
						quantum superpositions, wavefunctions, entanglement
					</Box>
					<Box fontSize="body-m">Sun Aug 30 · 3:00–6:00 PM CDT</Box>
					<Box fontSize="body-s" color="text-body-secondary">
						Bilingual workshop with accommodations for English and Spanish
						speakers
					</Box>
					<SpaceBetween size="xs" direction="horizontal">
						<Button variant="primary" href={REGISTER_URL}>
							Register for Workshop
						</Button>
						<Button variant="link" href={MEETUP_URL} target="_blank">
							RSVP on Meetup
						</Button>
					</SpaceBetween>
				</SpaceBetween>
			</Container>

			{/* Description */}
			<Container
				header={<Header variant="h2">3-hour hands-on workshop</Header>}
			>
				<Box fontSize="body-m">
					A beginner-friendly intro to{" "}
					<Link href={BRAKET_URL} external>
						Amazon Braket
					</Link>{" "}
					— we'll build up superposition and entanglement, then run Deutsch's
					algorithm using Amazon Braket quantum computing from AWS. Bring your
					questions.
				</Box>
			</Container>

			{/* Speakers */}
			<Container header={<Header variant="h2">Speakers</Header>}>
				<Grid gridDefinition={[{ colspan: 4 }, { colspan: 4 }, { colspan: 4 }]}>
					<SpaceBetween size="xs" alignItems="center">
						<img
							src={CHRISTIAN_AVATAR}
							alt="Christian Perez"
							style={{
								width: 80,
								height: 80,
								borderRadius: "50%",
								border: "3px solid #c9a23f",
							}}
						/>
						<Box fontWeight="bold">
							<Link href={CHRISTIAN_PROFILE} external>
								Christian Perez
							</Link>
						</Box>
						<Box color="text-body-secondary" fontSize="body-s">
							CEO · HOST
						</Box>
					</SpaceBetween>
					<SpaceBetween size="xs" alignItems="center">
						<div
							style={{
								width: 80,
								height: 80,
								borderRadius: "50%",
								background: "linear-gradient(135deg, #5a1f8a, #9060f0)",
								display: "flex",
								alignItems: "center",
								justifyContent: "center",
								color: "#fff",
								fontSize: "1.4rem",
								fontWeight: 700,
							}}
						>
							AH
						</div>
						<Box fontWeight="bold">Amelia Hough-Ross</Box>
						<Box color="text-body-secondary" fontSize="body-s">
							Chief Data Officer
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
							CTO
						</Box>
					</SpaceBetween>
				</Grid>
			</Container>

			{/* Hosting */}
			<Container
				header={<Header variant="h2">Hosted by Cloud Del Norte</Header>}
			>
				<SpaceBetween size="s">
					<Box>
						AWS User Group serving Far West Texas, New Mexico & Chihuahua,
						Mexico
					</Box>
					<Box>
						Featuring speakers and attendees from AWS User Groups in
						Clarksville, Columbia & USC
					</Box>
					<Link href={GLOBAL_UG_URL} external>
						Find your local AWS User Group →
					</Link>
				</SpaceBetween>
			</Container>

			{/* Footer CTA */}
			<Box textAlign="center">
				<Button variant="primary" href={REGISTER_URL}>
					Register for Workshop
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

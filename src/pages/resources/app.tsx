import Badge from "@cloudscape-design/components/badge";
import Box from "@cloudscape-design/components/box";
import Container from "@cloudscape-design/components/container";
import ContentLayout from "@cloudscape-design/components/content-layout";
import Header from "@cloudscape-design/components/header";
import Link from "@cloudscape-design/components/link";
import SpaceBetween from "@cloudscape-design/components/space-between";
import { useState } from "react";
import Navigation from "../../components/navigation";
import Shell from "../../layouts/shell";
import { formatLocation, STREAMS } from "../../lib/streams";
import {
	applyLocale,
	initializeLocale,
	type Locale,
	setStoredLocale,
} from "../../utils/locale";
import {
	applyTheme,
	initializeTheme,
	setStoredTheme,
	type Theme,
} from "../../utils/theme";
import "./styles.css";

function StreamCard({ stream }: { stream: (typeof STREAMS)[number] }) {
	const type = stream.type ?? "radio";
	return (
		<div className="cdn-resource-card">
			<SpaceBetween size="xs">
				<SpaceBetween size="xs" direction="horizontal" alignItems="center">
					<Box variant="h3">{stream.label}</Box>
					<Badge color={type === "radio" ? "blue" : "green"}>{type}</Badge>
				</SpaceBetween>
				<Box variant="small" color="text-body-secondary">
					{formatLocation(stream.location)}
				</Box>
				<SpaceBetween size="xs" direction="horizontal">
					{stream.scheduleUrl && (
						<Link href={stream.scheduleUrl} external variant="primary">
							schedule
						</Link>
					)}
					{stream.donateUrl && (
						<Link href={stream.donateUrl} external variant="primary">
							donate
						</Link>
					)}
				</SpaceBetween>
			</SpaceBetween>
		</div>
	);
}

function ResourcesFavoritesContent() {
	const curated = STREAMS.filter((s) => s.curated);
	const radio = curated.filter((s) => (s.type ?? "radio") === "radio");
	const podcasts = curated.filter((s) => s.type === "podcast");

	return (
		<ContentLayout header={<Header variant="h1">Resources</Header>}>
			<SpaceBetween size="l">
				<Container header={<Header variant="h2">Radio Stations</Header>}>
					<div className="cdn-resource-grid">
						{radio.map((s) => (
							<StreamCard key={s.key} stream={s} />
						))}
					</div>
				</Container>
				<Container header={<Header variant="h2">Podcasts</Header>}>
					<div className="cdn-resource-grid">
						{podcasts.map((s) => (
							<StreamCard key={s.key} stream={s} />
						))}
					</div>
				</Container>
			</SpaceBetween>
		</ContentLayout>
	);
}

export default function App() {
	const [theme, setTheme] = useState<Theme>(() => initializeTheme());
	const [locale, setLocale] = useState<Locale>(() => initializeLocale());

	return (
		<Shell
			theme={theme}
			onThemeChange={(t) => {
				setTheme(t);
				applyTheme(t);
				setStoredTheme(t);
			}}
			locale={locale}
			onLocaleChange={(l) => {
				setLocale(l);
				applyLocale(l);
				setStoredLocale(l);
			}}
			navigation={<Navigation />}
		>
			<ResourcesFavoritesContent />
		</Shell>
	);
}

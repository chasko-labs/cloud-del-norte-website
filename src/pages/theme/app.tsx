// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import Box from "@cloudscape-design/components/box";
import ColumnLayout from "@cloudscape-design/components/column-layout";
import Container from "@cloudscape-design/components/container";
import ContentLayout from "@cloudscape-design/components/content-layout";
import Grid from "@cloudscape-design/components/grid";
import Header from "@cloudscape-design/components/header";
import SpaceBetween from "@cloudscape-design/components/space-between";
import { useCallback, useEffect, useState } from "react";
import Breadcrumbs from "../../components/breadcrumbs";
import Navigation from "../../components/navigation";
import { LocaleProvider } from "../../contexts/locale-context";
import { useTranslation } from "../../hooks/useTranslation";
import Shell from "../../layouts/shell";
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
import {
	brandColors,
	elevationLevels,
	shadowTokens,
	textEmphasisLevels,
	typographyScale,
} from "./data";
import "./custom-theme.css";

/* --------------------------------------------------------------------------
   palette data — full CDN color system including semantic tokens
   -------------------------------------------------------------------------- */

interface SwatchEntry {
	name: string;
	token: string;
	hex: string;
	note?: string;
}

const allPaletteSwatches: SwatchEntry[] = [
	{ name: "Navy", token: "--cdn-navy", hex: "#00002a", note: "base dark bg" },
	{
		name: "Navy Mid",
		token: "--cdn-navy-mid",
		hex: "#000040",
		note: "mid navy",
	},
	{
		name: "Espresso",
		token: "--cdn-gradient-nav-start",
		hex: "#2c1206",
		note: "top nav / espresso",
	},
	{
		name: "Purple Deep",
		token: "--cdn-purple-deep",
		hex: "#30006a",
		note: "dark mode nav end",
	},
	{
		name: "Purple",
		token: "--cdn-purple",
		hex: "#5a1f8a",
		note: "primary interactive",
	},
	{
		name: "Violet",
		token: "--cdn-violet",
		hex: "#9060f0",
		note: "accent + glow",
	},
	{
		name: "Lavender",
		token: "--cdn-lavender",
		hex: "#d7c7ee",
		note: "light borders / dark text",
	},
	{
		name: "Amber",
		token: "--cdn-amber",
		hex: "#8b5a2b",
		note: "warm sepia accent",
	},
	{
		name: "Gold",
		token: "--cdn-gold",
		hex: "#c9a23f",
		note: "emeritus accent",
	},
	{
		name: "AWS Orange",
		token: "--cdn-aws-orange",
		hex: "#FF9900",
		note: "CTA emphasis",
	},
	{
		name: "Cream",
		token: "--color-background-container-content-6u8rvp",
		hex: "#faf7f0",
		note: "card surface (light)",
	},
	{
		name: "Indigo",
		token: "--cdn-elevation-2",
		hex: "#1a1a4a",
		note: "elevation 2 (dark)",
	},
];

/* --------------------------------------------------------------------------
   spacing data
   -------------------------------------------------------------------------- */

const spacingTokens = [
	{ token: "--cdn-space-xs", value: "4px", px: 4 },
	{ token: "--cdn-space-sm", value: "8px", px: 8 },
	{ token: "--cdn-space-md", value: "16px", px: 16 },
	{ token: "--cdn-space-lg", value: "24px", px: 24 },
	{ token: "--cdn-space-xl", value: "40px", px: 40 },
];

/* --------------------------------------------------------------------------
   animation vocabulary data
   -------------------------------------------------------------------------- */

const animationDemos = [
	{
		key: "nav-shimmer",
		label: "cdn-shimmer",
		description: "nav shimmer — 4s linear sweep",
		demo: "shimmer-bar",
	},
	{
		key: "station-shimmer",
		label: "krux-station-shimmer",
		description: "station text — 3s periodic sweep",
		demo: "station-text",
	},
	{
		key: "glass-ring",
		label: "krux-glass-ring",
		description: "conic ring on play button",
		demo: "glass-ring-btn",
	},
	{
		key: "playing-pulse",
		label: "krux-playing-pulse",
		description: "box-shadow pulse on active play",
		demo: "pulse-btn",
	},
	{
		key: "headphones-bob",
		label: "krux-headphones-bob",
		description: "2.4s ease-in-out bob",
		demo: "headphones",
	},
	{
		key: "toggle-flip",
		label: "cdn-toggle-flip",
		description: "0.4s theme toggle flip",
		demo: "toggle",
	},
	{
		key: "article-fade",
		label: "feed-article-fade-in",
		description: "article card entry animation",
		demo: "article",
	},
];

/* --------------------------------------------------------------------------
   AnimationDemoTile
   -------------------------------------------------------------------------- */

function ShimmerBarDemo() {
	return <div className="theme-demo-shimmer-bar" aria-hidden="true" />;
}

function StationTextDemo() {
	return (
		<span className="theme-demo-station-text" aria-hidden="true">
			KRUX Station
		</span>
	);
}

function GlassRingBtnDemo() {
	return (
		<div className="theme-demo-glass-btn" aria-hidden="true">
			&#9654;
		</div>
	);
}

function PulseBtnDemo() {
	return (
		<div className="theme-demo-pulse-btn" aria-hidden="true">
			&#9646;&#9646;
		</div>
	);
}

function HeadphonesDemo() {
	return (
		<span className="theme-demo-headphones" role="img" aria-label="headphones">
			&#127911;
		</span>
	);
}

function ToggleFlipDemo() {
	const [flipping, setFlipping] = useState(false);

	const trigger = useCallback(() => {
		if (flipping) return;
		setFlipping(true);
		setTimeout(() => setFlipping(false), 500);
	}, [flipping]);

	return (
		<button
			type="button"
			className={`theme-demo-toggle-icon${flipping ? " theme-demo-toggle-icon--flipping" : ""}`}
			onClick={trigger}
			aria-label="trigger toggle flip animation"
			title="click to trigger"
		>
			&#9728;
		</button>
	);
}

function ArticleFadeDemo() {
	const [key, setKey] = useState(0);

	const replay = useCallback(() => setKey((k) => k + 1), []);

	return (
		<button
			type="button"
			style={{
				background: "none",
				border: "none",
				padding: 0,
				cursor: "pointer",
			}}
			onClick={replay}
			aria-label="replay article fade-in animation"
			title="click to replay"
		>
			<div
				key={key}
				className="theme-demo-article-container"
				aria-hidden="true"
			>
				<div className="theme-demo-article-item" />
				<div className="theme-demo-article-item" />
				<div className="theme-demo-article-item" />
			</div>
		</button>
	);
}

function AnimDemoTile({ demo }: { demo: (typeof animationDemos)[0] }) {
	const demoEl = () => {
		switch (demo.demo) {
			case "shimmer-bar":
				return <ShimmerBarDemo />;
			case "station-text":
				return <StationTextDemo />;
			case "glass-ring-btn":
				return <GlassRingBtnDemo />;
			case "pulse-btn":
				return <PulseBtnDemo />;
			case "headphones":
				return <HeadphonesDemo />;
			case "toggle":
				return <ToggleFlipDemo />;
			case "article":
				return <ArticleFadeDemo />;
			default:
				return null;
		}
	};

	return (
		<div className="theme-anim-demo">
			{demoEl()}
			<span className="theme-anim-demo__label">{demo.label}</span>
			<span className="theme-anim-demo__token">{demo.description}</span>
		</div>
	);
}

/* --------------------------------------------------------------------------
   KruxPlayer widget demo — idle + playing states
   -------------------------------------------------------------------------- */

function KruxWidgetDemo() {
	return (
		<div className="theme-krux-widget">
			{/* idle state */}
			<div className="theme-krux-state">
				<div className="theme-krux-state__heading">idle — not playing</div>
				<div className="theme-krux-player">
					<div className="theme-krux-player__top">
						{/* skip pill */}
						<button
							type="button"
							className="feed-krux__skip"
							aria-label="skip station"
						>
							&#187;&#187;
						</button>
						{/* label with headphones + station shimmer */}
						<button
							type="button"
							className="feed-krux__label"
							aria-label="krux stream idle"
						>
							<span className="feed-krux__headphones" aria-hidden="true">
								&#127911;
							</span>
							<span className="feed-krux__station">KRUX Station</span>
						</button>
						{/* play button with glass ring */}
						<button
							type="button"
							className="feed-krux__btn"
							aria-label="play krux stream"
							data-state="idle"
						>
							&#9654;
						</button>
					</div>
					<span className="feed-krux__now-playing">
						aws builders radio — 24/7 stream
					</span>
				</div>
			</div>

			{/* playing state */}
			<div className="theme-krux-state">
				<div className="theme-krux-state__heading">playing — active state</div>
				<div className="theme-krux-player">
					<div className="theme-krux-player__top">
						{/* skip pill */}
						<button
							type="button"
							className="feed-krux__skip"
							aria-label="skip station"
						>
							&#187;&#187;
						</button>
						{/* label with bobbing headphones + steady violet text */}
						<button
							type="button"
							className="feed-krux__label feed-krux__label--playing"
							aria-label="krux stream playing"
						>
							<span
								className="feed-krux__headphones feed-krux__headphones--playing"
								aria-hidden="true"
							>
								&#127911;
							</span>
							<span
								style={{
									background: "none",
									WebkitTextFillColor: "var(--cdn-violet, #9060f0)",
									color: "var(--cdn-violet, #9060f0)",
									fontWeight:
										"var(--cdn-weight-medium)" as React.CSSProperties["fontWeight"],
								}}
							>
								KRUX Station
							</span>
						</button>
						{/* stop button with pulse animation */}
						<button
							type="button"
							className="feed-krux__btn"
							aria-label="stop krux stream"
							data-state="playing"
						>
							&#9646;&#9646;
						</button>
					</div>
					<span className="feed-krux__now-playing">
						now playing: builders lab live — track 04
					</span>
				</div>
			</div>
		</div>
	);
}

/* --------------------------------------------------------------------------
   Interactive states demo section
   -------------------------------------------------------------------------- */

function InteractiveStatesDemo() {
	return (
		<div className="theme-interactive-grid">
			<div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
				<div
					className="theme-hover-demo theme-hover-demo--sidenav"
					role="presentation"
				>
					<Box variant="p" fontSize="body-s">
						side nav item
					</Box>
					<Box variant="small" color="text-body-secondary">
						hover to see inset accent
					</Box>
				</div>
				<span className="theme-interactive-label">
					side nav hover — inset left-accent flash
					<br />
					amber (light) / violet (dark)
				</span>
			</div>

			<div
				style={{
					display: "flex",
					flexDirection: "column",
					gap: 6,
					alignItems: "flex-start",
				}}
			>
				<div
					className="theme-hover-demo"
					style={{
						padding: "12px 16px",
						background:
							"linear-gradient(135deg, var(--cdn-gradient-nav-start) 0%, var(--cdn-gradient-nav-end) 100%)",
					}}
					role="presentation"
					aria-label="top nav shimmer — shimmer sweeps automatically"
				>
					<span
						style={{
							color: "rgba(240,240,240,0.87)",
							fontSize: "var(--cdn-text-sm)",
							letterSpacing: "0.04em",
						}}
					>
						cloud del norte
					</span>
				</div>
				<span className="theme-interactive-label">
					top nav shimmer — cdn-shimmer 4s linear
				</span>
			</div>

			<div
				style={{
					display: "flex",
					flexDirection: "column",
					gap: 6,
					alignItems: "flex-start",
				}}
			>
				<button
					type="button"
					className="theme-hover-demo--skip"
					aria-label="skip button hover demo"
				>
					&#187;&#187; skip
				</button>
				<span className="theme-interactive-label">
					skip pill hover — scale(1.1) + outer glow
				</span>
			</div>

			<div
				style={{
					display: "flex",
					flexDirection: "column",
					gap: 6,
					alignItems: "flex-start",
				}}
			>
				<span className="theme-badge-pill" role="presentation">
					info
				</span>
				<span className="theme-interactive-label">
					info badge pill
					<br />
					purple (light) / violet (dark)
				</span>
			</div>
		</div>
	);
}

/* --------------------------------------------------------------------------
   Glassmorphism demo section
   -------------------------------------------------------------------------- */

function GlassmorphismDemo() {
	return (
		<SpaceBetween size="l">
			<Box variant="p" fontSize="body-s">
				the .cdn-card class — backdrop-filter blur, gradient surface, animated
				accent line, warm amber glow (light) / violet glow (dark)
			</Box>
			<div className="theme-glass-grid">
				{/* cdn-card standard */}
				<div className="cdn-card theme-glass-demo">
					<SpaceBetween size="xs">
						<Box variant="strong" fontSize="heading-s">
							glassmorphism card
						</Box>
						<Box variant="p" fontSize="body-s">
							light mode: warm cream gradient + amber border + shadow
						</Box>
						<Box variant="small" color="text-body-secondary">
							.cdn-card
						</Box>
					</SpaceBetween>
				</div>

				{/* glass ring standalone */}
				<div
					style={{
						display: "flex",
						flexDirection: "column",
						alignItems: "center",
						justifyContent: "center",
						gap: 12,
						padding: "20px 16px",
						borderRadius: "var(--cdn-radius-md)",
						border: "1px solid var(--cdn-color-border)",
					}}
				>
					<div className="theme-demo-glass-ring" aria-hidden="true">
						&#9654;
					</div>
					<Box variant="small" color="text-body-secondary">
						conic-gradient ring — krux-glass-ring
					</Box>
				</div>

				{/* dark elevation card */}
				<div
					style={{
						padding: "20px",
						borderRadius: "var(--cdn-radius-xl)",
						background: "var(--cdn-elevation-1, #12123a)",
						border: "1px solid rgba(144, 96, 240, 0.15)",
						boxShadow:
							"0 8px 24px -6px rgba(0,0,0,0.3), 0 0 20px -8px rgba(144, 96, 240, 0.1)",
					}}
				>
					<SpaceBetween size="xs">
						<Box variant="strong" fontSize="heading-s">
							<span style={{ color: "var(--cdn-lavender, #d7c7ee)" }}>
								dark mode glass
							</span>
						</Box>
						<Box variant="p" fontSize="body-s">
							<span style={{ color: "rgba(240,240,240,0.6)" }}>
								navy background + violet glow border
							</span>
						</Box>
						<Box variant="small" color="text-body-secondary">
							elevation-1 + cdn-shadow-glow
						</Box>
					</SpaceBetween>
				</div>
			</div>
		</SpaceBetween>
	);
}

/* --------------------------------------------------------------------------
   Typography extras — font smoothing + letter spacing
   -------------------------------------------------------------------------- */

function TypographyExtrasDemo() {
	const sampleText = "The quick brown fox — cloud del norte";

	return (
		<SpaceBetween size="m">
			<Box variant="p" fontSize="body-s">
				font smoothing demo — compare antialiased vs browser default
			</Box>

			<div className="theme-type-comparison">
				<div className="theme-type-sample theme-type-sample--antialiased">
					<div className="theme-type-sample__heading">
						antialiased (cdn default)
					</div>
					<p className="theme-type-sample__text">{sampleText}</p>
					<Box variant="code" fontSize="body-s">
						-webkit-font-smoothing: antialiased
					</Box>
				</div>
				<div className="theme-type-sample theme-type-sample--default">
					<div className="theme-type-sample__heading">
						browser default (auto)
					</div>
					<p className="theme-type-sample__text">{sampleText}</p>
					<Box variant="code" fontSize="body-s">
						-webkit-font-smoothing: auto
					</Box>
				</div>
			</div>

			<Box variant="p" fontSize="body-s">
				letter spacing tokens
			</Box>

			<div className="theme-letter-spacing-row">
				<div className="theme-letter-spacing-row__item">
					<span className="theme-letter-spacing-row__token">
						body (0.005em)
					</span>
					<span
						className="theme-letter-spacing-row__sample"
						style={{ letterSpacing: "0.005em" }}
					>
						Cloud Del Norte Meetup
					</span>
				</div>
				<div className="theme-letter-spacing-row__item">
					<span className="theme-letter-spacing-row__token">
						body-copy (0.01em)
					</span>
					<span
						className="theme-letter-spacing-row__sample"
						style={{ letterSpacing: "0.01em" }}
					>
						Cloud Del Norte Meetup
					</span>
				</div>
				<div className="theme-letter-spacing-row__item">
					<span className="theme-letter-spacing-row__token">
						labels (0.04em)
					</span>
					<span
						className="theme-letter-spacing-row__sample"
						style={{ letterSpacing: "0.04em" }}
					>
						Cloud Del Norte Meetup
					</span>
				</div>
				<div className="theme-letter-spacing-row__item">
					<span className="theme-letter-spacing-row__token">
						badges (0.06em)
					</span>
					<span
						className="theme-letter-spacing-row__sample"
						style={{
							letterSpacing: "0.06em",
							textTransform: "uppercase",
							fontSize: "0.68rem",
							fontWeight: 600,
						}}
					>
						Cloud Del Norte
					</span>
				</div>
			</div>
		</SpaceBetween>
	);
}

/* --------------------------------------------------------------------------
   AppContent
   -------------------------------------------------------------------------- */

function AppContent({
	theme: _theme,
	onThemeChange: _onThemeChange,
	locale: _locale,
	onLocaleChange: _onLocaleChange,
}: {
	theme: Theme;
	onThemeChange: (t: Theme) => void;
	locale: Locale;
	onLocaleChange: (l: Locale) => void;
}) {
	const { t } = useTranslation();

	useEffect(() => {
		document.title = t("themePage.pageTitle");
	}, [t]);

	return (
		<ContentLayout
			header={<Header variant="h1">{t("themePage.header")}</Header>}
		>
			<SpaceBetween size="l">
				{/* ── 1. Color palette ── */}
				<Container
					header={
						<Header variant="h2">{t("themePage.sections.brandColors")}</Header>
					}
				>
					<SpaceBetween size="m">
						<Box variant="p">
							{t("themePage.sections.brandColorsDescription")}
						</Box>

						{/* original brand swatches from data.ts */}
						<Grid
							gridDefinition={[
								{ colspan: { default: 12, xs: 6, s: 4, m: 3 } },
								{ colspan: { default: 12, xs: 6, s: 4, m: 3 } },
								{ colspan: { default: 12, xs: 6, s: 4, m: 3 } },
								{ colspan: { default: 12, xs: 6, s: 4, m: 3 } },
								{ colspan: { default: 12, xs: 6, s: 4, m: 3 } },
								{ colspan: { default: 12, xs: 6, s: 4, m: 3 } },
								{ colspan: { default: 12, xs: 6, s: 4, m: 3 } },
							]}
						>
							{brandColors.map((color) => (
								<Box key={color.variable} padding="s">
									<SpaceBetween size="xs">
										<div
											style={{
												backgroundColor: color.hex,
												height: "80px",
												borderRadius: "8px",
												border: "1px solid var(--cdn-color-border)",
											}}
										/>
										<Box variant="strong" fontSize="body-s">
											{t(color.name)}
										</Box>
										<Box variant="code" fontSize="body-s">
											{color.variable}
										</Box>
										<Box variant="small" color="text-body-secondary">
											{color.hex}
										</Box>
										<Box variant="p" fontSize="body-s">
											{t(color.description)}
										</Box>
									</SpaceBetween>
								</Box>
							))}
						</Grid>

						{/* full palette grid including semantic / light-mode-only tokens */}
						<Box variant="h3" fontSize="heading-s" padding={{ top: "m" }}>
							full system palette
						</Box>
						<div className="theme-color-grid">
							{allPaletteSwatches.map((s) => (
								<div key={s.token} className="theme-color-swatch">
									<div
										className="theme-color-swatch__chip"
										role="img"
										style={{ backgroundColor: s.hex }}
										aria-label={`${s.name} color chip`}
									/>
									<span className="theme-color-swatch__name">{s.name}</span>
									<span className="theme-color-swatch__token">{s.token}</span>
									<span className="theme-color-swatch__hex">{s.hex}</span>
									{s.note && (
										<span className="theme-color-swatch__hex">{s.note}</span>
									)}
								</div>
							))}
						</div>
					</SpaceBetween>
				</Container>

				{/* ── 2. Motion & animations ── */}
				<Container
					header={<Header variant="h2">motion &amp; animations</Header>}
				>
					<SpaceBetween size="m">
						<Box variant="p" fontSize="body-s">
							live running demos of every animation in the cdn vocabulary.
							toggle flip and article fade are clickable to replay. all
							animations pause under prefers-reduced-motion.
						</Box>
						<Grid
							gridDefinition={[
								{ colspan: { default: 12, xs: 6, s: 4, m: 3 } },
								{ colspan: { default: 12, xs: 6, s: 4, m: 3 } },
								{ colspan: { default: 12, xs: 6, s: 4, m: 3 } },
								{ colspan: { default: 12, xs: 6, s: 4, m: 3 } },
								{ colspan: { default: 12, xs: 6, s: 4, m: 3 } },
								{ colspan: { default: 12, xs: 6, s: 4, m: 3 } },
								{ colspan: { default: 12, xs: 6, s: 4, m: 3 } },
							]}
						>
							{animationDemos.map((demo) => (
								<AnimDemoTile key={demo.key} demo={demo} />
							))}
						</Grid>
					</SpaceBetween>
				</Container>

				{/* ── 3. Radio player (KruxPlayer widget) ── */}
				<Container header={<Header variant="h2">radio player widget</Header>}>
					<SpaceBetween size="m">
						<Box variant="p" fontSize="body-s">
							full KruxPlayer widget in idle and playing states. idle: periodic
							station shimmer + rotating glass ring. playing: pulsing play
							button + headphone bob + steady violet text.
						</Box>
						<KruxWidgetDemo />
					</SpaceBetween>
				</Container>

				{/* ── 4. Interactive states ── */}
				<Container header={<Header variant="h2">interactive states</Header>}>
					<SpaceBetween size="m">
						<Box variant="p" fontSize="body-s">
							hover over each element to see the CDN interactive treatment.
						</Box>
						<InteractiveStatesDemo />
					</SpaceBetween>
				</Container>

				{/* ── 5. Typography ── */}
				<Container
					header={
						<Header variant="h2">{t("themePage.sections.typography")}</Header>
					}
				>
					<SpaceBetween size="m">
						<Box variant="p">
							{t("themePage.sections.typographyDescription")}
						</Box>
						<SpaceBetween size="s">
							{typographyScale.map((type) => (
								<Box key={type.variable} padding="s">
									<ColumnLayout columns={3} variant="text-grid">
										<div>
											<Box
												variant="strong"
												fontSize={
													type.variable === "--cdn-text-sm"
														? "body-s"
														: type.variable === "--cdn-text-base"
															? "body-m"
															: type.variable === "--cdn-text-lg"
																? "heading-s"
																: type.variable === "--cdn-text-xl"
																	? "heading-m"
																	: "heading-l"
												}
											>
												{t(type.name)}
											</Box>
										</div>
										<div>
											<SpaceBetween size="xxs">
												<Box variant="code" fontSize="body-s">
													{type.variable}
												</Box>
												<Box variant="small" color="text-body-secondary">
													{type.size}
												</Box>
											</SpaceBetween>
										</div>
										<Box variant="p" fontSize="body-s">
											{t(type.usage)}
										</Box>
									</ColumnLayout>
								</Box>
							))}
						</SpaceBetween>
						<TypographyExtrasDemo />
					</SpaceBetween>
				</Container>

				{/* ── 6. Glassmorphism / surface patterns ── */}
				<Container
					header={
						<Header variant="h2">glassmorphism &amp; surface patterns</Header>
					}
				>
					<GlassmorphismDemo />
				</Container>

				{/* ── 7. Spacing scale ── */}
				<Container header={<Header variant="h2">spacing scale</Header>}>
					<SpaceBetween size="m">
						<Box variant="p" fontSize="body-s">
							spacing tokens — use these for padding, gap, and margin decisions.
						</Box>
						<div className="theme-spacing-ruler">
							{spacingTokens.map((s) => (
								<div key={s.token} className="theme-spacing-row">
									<span className="theme-spacing-row__token">{s.token}</span>
									<div
										className="theme-spacing-row__bar"
										role="img"
										style={{ width: s.px * 3 }}
										aria-label={`${s.value} spacing bar`}
									/>
									<span className="theme-spacing-row__value">{s.value}</span>
								</div>
							))}
						</div>
					</SpaceBetween>
				</Container>

				{/* ── text emphasis (retained from original) ── */}
				<Container
					header={
						<Header variant="h2">{t("themePage.sections.textEmphasis")}</Header>
					}
				>
					<SpaceBetween size="m">
						<Box variant="p">
							{t("themePage.sections.textEmphasisDescription")}
						</Box>
						<ColumnLayout columns={3} variant="text-grid">
							{textEmphasisLevels.map((level) => (
								<Box key={level.variable} padding="s">
									<SpaceBetween size="xs">
										<Box variant="strong" fontSize="heading-m">
											{t(level.name)}
										</Box>
										<Box variant="code" fontSize="body-s">
											{level.variable}
										</Box>
										<Box variant="small" color="text-body-secondary">
											{level.hex}
										</Box>
										<Box variant="p" fontSize="body-s">
											{t(level.description)}
										</Box>
									</SpaceBetween>
								</Box>
							))}
						</ColumnLayout>
					</SpaceBetween>
				</Container>

				{/* ── dark mode elevation (retained from original) ── */}
				<Container
					header={
						<Header variant="h2">{t("themePage.sections.elevation")}</Header>
					}
				>
					<SpaceBetween size="m">
						<Box variant="p">
							{t("themePage.sections.elevationDescription")}
						</Box>
						<ColumnLayout columns={4} variant="text-grid">
							{elevationLevels.map((elevation) => (
								<Box key={elevation.variable} padding="s">
									<SpaceBetween size="xs">
										<div
											style={{
												backgroundColor: elevation.hex,
												height: "80px",
												borderRadius: "8px",
												border: "1px solid var(--cdn-color-border)",
												display: "flex",
												alignItems: "center",
												justifyContent: "center",
												color: "var(--cdn-color-text-high)",
											}}
										>
											<Box variant="strong">{`${t("themePage.elevation.level")} ${elevation.level}`}</Box>
										</div>
										<Box variant="code" fontSize="body-s">
											{elevation.variable}
										</Box>
										<Box variant="small" color="text-body-secondary">
											{elevation.hex}
										</Box>
										<Box variant="p" fontSize="body-s">
											{t(elevation.usage)}
										</Box>
									</SpaceBetween>
								</Box>
							))}
						</ColumnLayout>
					</SpaceBetween>
				</Container>

				{/* ── shadow tokens (retained from original) ── */}
				<Container
					header={
						<Header variant="h2">{t("themePage.sections.shadows")}</Header>
					}
				>
					<SpaceBetween size="m">
						<Box variant="p">{t("themePage.sections.shadowsDescription")}</Box>
						<Grid
							gridDefinition={[
								{ colspan: { default: 12, s: 4 } },
								{ colspan: { default: 12, s: 4 } },
								{ colspan: { default: 12, s: 4 } },
							]}
						>
							{shadowTokens.map((shadow) => (
								<Box key={shadow.variable} padding="s">
									<SpaceBetween size="xs">
										<div
											style={{
												backgroundColor: "var(--cdn-color-surface)",
												height: "100px",
												borderRadius: "8px",
												boxShadow: `var(${shadow.variable})`,
												display: "flex",
												alignItems: "center",
												justifyContent: "center",
											}}
										>
											<Box variant="strong">{t(shadow.name)}</Box>
										</div>
										<Box variant="code" fontSize="body-s">
											{shadow.variable}
										</Box>
										<Box variant="p" fontSize="body-s">
											{t(shadow.usage)}
										</Box>
									</SpaceBetween>
								</Box>
							))}
						</Grid>
					</SpaceBetween>
				</Container>

				{/* ── glassmorphism card example (retained from original) ── */}
				<Container
					header={
						<Header variant="h2">{t("themePage.sections.cardExample")}</Header>
					}
				>
					<SpaceBetween size="m">
						<Box variant="p">
							{t("themePage.sections.cardExampleDescription")}
						</Box>
						<div className="cdn-card" style={{ padding: "24px" }}>
							<SpaceBetween size="s">
								<Box variant="h3" fontSize="heading-m">
									{t("themePage.cardExample.title")}
								</Box>
								<Box variant="p">{t("themePage.cardExample.description")}</Box>
								<Box variant="small" color="text-body-secondary">
									{t("themePage.cardExample.technicalNote")}
								</Box>
							</SpaceBetween>
						</div>
					</SpaceBetween>
				</Container>
			</SpaceBetween>
		</ContentLayout>
	);
}

function BreadcrumbsContent() {
	const { t } = useTranslation();
	return (
		<Breadcrumbs
			active={{ text: t("themePage.breadcrumb"), href: "/theme/index.html" }}
		/>
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
				breadcrumbs={<BreadcrumbsContent />}
				navigation={<Navigation />}
			>
				<AppContent
					theme={theme}
					onThemeChange={handleThemeChange}
					locale={locale}
					onLocaleChange={handleLocaleChange}
				/>
			</Shell>
		</LocaleProvider>
	);
}

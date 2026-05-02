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
	elevationLevels,
	paletteGroups,
	radiusTokens,
	shadowTokens,
	textEmphasisLevels,
	typographyScale,
} from "./data";
import "./custom-theme.css";

/* --------------------------------------------------------------------------
   Palette group section component
   -------------------------------------------------------------------------- */

function PaletteGroupSection() {
	return (
		<SpaceBetween size="l">
			{paletteGroups.map((group) => (
				<div key={group.label} className="theme-palette-group">
					<div className="theme-palette-group__label">{group.label}</div>
					<div className="theme-palette-group__swatches">
						{group.swatches.map((swatch) => (
							<div key={swatch.token} className="theme-palette-swatch">
								<div
									className="theme-palette-swatch__chip"
									role="img"
									aria-label={`${swatch.name} — ${swatch.hex}`}
									style={{ backgroundColor: swatch.hex }}
								/>
								<span className="theme-palette-swatch__name">
									{swatch.name}
								</span>
								<span className="theme-palette-swatch__token">
									{swatch.token}
								</span>
								<span className="theme-palette-swatch__hex">{swatch.hex}</span>
								{swatch.role && (
									<span className="theme-palette-swatch__role">
										{swatch.role}
									</span>
								)}
							</div>
						))}
					</div>
				</div>
			))}
		</SpaceBetween>
	);
}

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
		description:
			"nav shimmer — 24s cycle, ~4.3s sweep, ~19.7s idle pause, brand-tinted",
		demo: "shimmer-bar",
	},
	{
		key: "station-shimmer",
		label: "krux-station-shimmer",
		description: "station text — 8s cycle, ~7.4s idle pause, brand-tinted",
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
					top nav shimmer — cdn-shimmer 24s ease-in-out
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

	const tocItems = [
		{ id: "colors", label: "color palette" },
		{ id: "borders", label: "borders + radius" },
		{ id: "motion", label: "motion + animations" },
		{ id: "player", label: "radio player" },
		{ id: "interactive", label: "interactive states" },
		{ id: "typography", label: "typography" },
		{ id: "glassmorphism", label: "glassmorphism" },
		{ id: "spacing", label: "spacing" },
		{ id: "text-emphasis", label: "text emphasis" },
		{ id: "elevation", label: "elevation" },
		{ id: "shadows", label: "shadows" },
	];

	return (
		<ContentLayout
			header={<Header variant="h1">{t("themePage.header")}</Header>}
		>
			<SpaceBetween size="l">
				{/* ── Brand logo ── */}
				<Container header={<Header variant="h2">brand logo</Header>}>
					<div className="theme-logo-showcase">
						<img
							src="/brand/logo.svg"
							alt="Cloud Del Norte AWS User Group"
							className="theme-logo-img"
						/>
						<div className="theme-logo-meta">
							<p>
								<strong>asset:</strong> <code>/brand/logo.svg</code>
							</p>
							<p>
								<strong>viewBox:</strong> 1024×1024 — square, transparent
							</p>
							<p>
								<strong>structure:</strong> 3 large purple star-arm paths + 12
								small circular bulb dots in a ring + near-white inner geometric
								structure (vtracer polygon trace)
							</p>
							<p>
								<strong>filters:</strong> SVG <code>&lt;defs&gt;</code> with{" "}
								<code>cdn-bulb-glow</code> (dual feGaussianBlur core+bloom) and{" "}
								<code>cdn-arm-glow</code>; bulbs animate independently with
								staggered <code>animation-delay</code> 0–2.75s
							</p>
						</div>
					</div>
				</Container>

				{/* ── TOC ── */}
				<Container header={<Header variant="h2">token index</Header>}>
					<nav className="theme-toc" aria-label="jump to section">
						{tocItems.map(({ id, label }) => (
							<a key={id} href={`#section-${id}`} className="theme-toc__link">
								{label}
							</a>
						))}
					</nav>
				</Container>

				{/* ── 1. Color palette ── */}
				<div id="section-colors">
					<Container
						header={
							<Header variant="h2">
								{t("themePage.sections.brandColors")}
							</Header>
						}
					>
						<SpaceBetween size="m">
							<Box variant="p">
								{t("themePage.sections.brandColorsDescription")}
							</Box>
							<PaletteGroupSection />
						</SpaceBetween>
					</Container>
				</div>

				{/* ── 1b. Borders + radius ── */}
				<div id="section-borders">
					<Container header={<Header variant="h2">borders + radius</Header>}>
						<SpaceBetween size="m">
							<Box variant="p" fontSize="body-s">
								border-radius tokens used across all cdn components — from tight
								chips to large glass cards.
							</Box>
							<div className="theme-radius-grid">
								{radiusTokens.map((token) => (
									<div key={token.variable} className="theme-radius-swatch">
										<div
											className="theme-radius-swatch__box"
											style={{ borderRadius: token.value }}
											role="img"
											aria-label={`${token.name} radius — ${token.value}`}
										/>
										<span className="theme-radius-swatch__name">
											{token.name}
										</span>
										<Box variant="code" fontSize="body-s">
											{token.variable}
										</Box>
										<Box variant="small" color="text-body-secondary">
											{token.value}
										</Box>
										<Box variant="small" color="text-body-secondary">
											{token.usage}
										</Box>
									</div>
								))}
							</div>
						</SpaceBetween>
					</Container>
				</div>

				{/* ── 2. Motion & animations ── */}
				<div id="section-motion">
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
				</div>

				{/* ── 3. Radio player (KruxPlayer widget) ── */}
				<div id="section-player">
					<Container header={<Header variant="h2">radio player widget</Header>}>
						<SpaceBetween size="m">
							<Box variant="p" fontSize="body-s">
								full KruxPlayer widget in idle and playing states. idle:
								periodic station shimmer + rotating glass ring. playing: pulsing
								play button + headphone bob + steady violet text.
							</Box>
							<KruxWidgetDemo />
						</SpaceBetween>
					</Container>
				</div>

				{/* ── 4. Interactive states ── */}
				<div id="section-interactive">
					<Container header={<Header variant="h2">interactive states</Header>}>
						<SpaceBetween size="m">
							<Box variant="p" fontSize="body-s">
								hover over each element to see the CDN interactive treatment.
							</Box>
							<InteractiveStatesDemo />
						</SpaceBetween>
					</Container>
				</div>

				{/* ── 5. Typography ── */}
				<div id="section-typography">
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
				</div>

				{/* ── 6. Glassmorphism / surface patterns ── */}
				<div id="section-glassmorphism">
					<Container
						header={
							<Header variant="h2">glassmorphism &amp; surface patterns</Header>
						}
					>
						<GlassmorphismDemo />
					</Container>
				</div>

				{/* ── 7. Spacing scale ── */}
				<div id="section-spacing">
					<Container header={<Header variant="h2">spacing scale</Header>}>
						<SpaceBetween size="m">
							<Box variant="p" fontSize="body-s">
								spacing tokens — use these for padding, gap, and margin
								decisions.
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
				</div>

				{/* ── text emphasis ── */}
				<div id="section-text-emphasis">
					<Container
						header={
							<Header variant="h2">
								{t("themePage.sections.textEmphasis")}
							</Header>
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
				</div>

				{/* ── dark mode elevation ── */}
				<div id="section-elevation">
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
				</div>

				{/* ── shadow tokens ── */}
				<div id="section-shadows">
					<Container
						header={
							<Header variant="h2">{t("themePage.sections.shadows")}</Header>
						}
					>
						<SpaceBetween size="m">
							<Box variant="p">
								{t("themePage.sections.shadowsDescription")}
							</Box>
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
				</div>

				{/* ── glassmorphism card example ── */}
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

// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import type { Locale } from "../../../utils/locale";

// Badge taxonomy — keep tight & structured so the pill component renders
// consistent labels and we can extend (e.g. "aws ambassador") without
// touching every card. The author→badge map is the single source of
// authority; cards omit `badge` and resolve it at render time.
export type BadgeKey = "employee" | "communityBuilder" | "hero";

export interface BuilderCenterCard {
	title: string;
	author: string;
	url: string;
	blurb: string;
	// Optional secondary tag (rendered next to badge). Only set on cards that
	// actually carry a track (e.g. AIdeas Finalist → "Software Engineering").
	sub?: string;
}

export interface BuilderDeck {
	primary: BuilderCenterCard[];
	carousel: BuilderCenterCard[];
}

// Author → badge resolution. Adding a future contributor: add one entry
// here, every card they write picks up the badge automatically.
const AUTHOR_BADGE: Record<string, BadgeKey> = {
	// aws employees
	Morgan: "employee",
	"Gunnar Grosch": "employee",
	"Lisa Bagley": "employee",
	"Maria Encinar": "employee",
	// aws community builders
	"Andres Moreno": "communityBuilder",
	"Endah Bongo-Awah": "communityBuilder",
	"Vicente G. Guzmán Lucio": "communityBuilder",
	"Joselyn Lagunas": "communityBuilder",
	"Brenda Galicia": "communityBuilder",
	"Hector David Martinez Montilla": "communityBuilder",
	"Barbara Gaspar": "communityBuilder",
	"Alex Parra": "communityBuilder",
	"Habeeb Babasulaiman": "communityBuilder",
	"Christian Perez": "communityBuilder",
	// aws heroes
	"Bryan Chasko": "hero",
	"David Victoria": "hero",
};

export function badgeForAuthor(author: string): BadgeKey | null {
	return AUTHOR_BADGE[author] ?? null;
}

// English deck — Gunnar's article moved to position #4.
const EN_PRIMARY: BuilderCenterCard[] = [
	{
		title:
			"From Germany to Cameroon: One Trip, Every Hat, and a Room Full of Future Cloud Engineers",
		author: "Endah Bongo-Awah",
		url: "https://builder.aws.com/content/3Bl58QC80ISb84FaIxwuYeebYcD/from-germany-to-cameroon-one-trip-every-hat-and-a-room-full-of-future-cloud-engineers",
		blurb:
			"When I stood before over 30 aspiring DevOps engineers in Cameroon, I saw something no slide deck could capture. I saw hunger. I saw curiosity. I saw a room full of young people who had already decided that their future would be built on cloud technology.",
	},
	{
		title: "What is an Agent Harness? A Hands-On Guide With AgentCore harness",
		author: "Morgan",
		url: "https://builder.aws.com/content/3D3890U2niEPp5gxlssoI9HVvWm/what-is-an-agent-harness-a-hands-on-guide-with-agentcore-harness",
		blurb:
			"An agent harness is the runtime that turns a model into an autonomous agent. I built one with Amazon Bedrock AgentCore Harness using only configuration. Here's what a harness is, how AgentCore harness works, and code you can run today.",
	},
	{
		title: "The Ultimate Guide to Container Secrets Management on AWS",
		author: "Habeeb Babasulaiman",
		url: "https://builder.aws.com/content/394qjN5YE7kYSfZWPTeDYey1fwM/the-ultimate-guide-to-container-secrets-management-on-aws-a-deep-dive-into-parameter-store-secrets-manager-and-hashicorp-vault",
		blurb:
			"I built a production-grade infrastructure comparing three secrets management approaches for containerized workloads on Amazon EKS.",
	},
	{
		title: "Can it run DOOM? Playing DOOM in Claude Code with DOOM MCP",
		author: "Gunnar Grosch",
		url: "https://builder.aws.com/content/3AmPDxn7EBkb5DTI9ERcCwPWjqk/can-it-run-doom-playing-doom-in-claude-code-with-doom-mcp",
		blurb:
			"Walk through the DOOM MCP server: how it wires Claude Code to a running DOOM instance and what that says about agent tool surfaces.",
	},
];

const EN_CAROUSEL: BuilderCenterCard[] = [
	{
		title: "AIdeas Finalist: Predict-Epidem",
		author: "Vicente G. Guzmán Lucio",
		url: "https://builder.aws.com/content/3B5n19jnSCfSKN6WqDvm1K1H5FK/aideas-finalist-predict-epidem",
		sub: "Software Engineering",
		blurb:
			"Predict-Epidem is an epidemiological intelligence system designed to monitor and predict outbreaks in Latin America.",
	},
	{
		title: "NFL IQ: How AWS Is Bringing Front Office Intelligence to Every Fan",
		author: "Lisa Bagley",
		url: "https://builder.aws.com/content/3Aj9DyqICgKltRSuEBMyVyOCfo6/nfl-iq-how-aws-is-bringing-front-office-intelligence-to-every-fan",
		blurb:
			"The NFL and AWS launched NFL IQ on March 2, 2026 — a living offseason intelligence platform on NFL.com powered by Amazon Quick that gives fans front-office-level insight.",
	},
	{
		title: "AIdeas Finalist: REGAIN - Your Professional Edge",
		author: "Christian Perez",
		url: "https://builder.aws.com/content/3BwChAzvUtvN1kq4uw1JfpuCEL5/aideas-finalist-regain-your-professional-edge",
		sub: "Founder & CEO | Altivum® Inc.",
		blurb:
			"A campaign driven career platform for veterans and AI displaced workers, built around evidence instead of enrollment and a voice native coach instead of another chat box. The output is a machine readable, evidence linked profile designed for a hiring environment moving toward agents.",
	},
	{
		title:
			"OpenClaw on AWS: A Curated Collection of AWS Builder Center articles",
		author: "Maria Encinar",
		url: "https://builder.aws.com/content/3Cx2x4C2gHfena1soKDOGrXzNWZ/openclaw-on-aws-a-curated-collection-of-aws-builder-center-articles",
		sub: "Community Geek leading the AWS User Group program",
		blurb:
			"Interested in OpenClaw on AWS? We've got you covered! We've put together a list of articles covering everything from basic EC2 deploys to multi-tenant setups, security audits, and agents that build their own.",
	},
];

// Spanish deck — when locale === "mx", the entire deck swaps. All 7 cards
// flow through the same primary+carousel split; first 4 are pinned, the
// remainder feed the hover-auto-scroll carousel.
const MX_ALL: BuilderCenterCard[] = [
	{
		title: "1000 Formas para entender la nube",
		author: "Joselyn Lagunas",
		url: "https://builder.aws.com/content/3DM63Cm4Mwy4WSwOoFzjRXkzgjM/1000-formas-para-entender-la-nube",
		blurb:
			"En este artículo se compartirán formas para aprender sobre la nube que probablemente desconocías, diferentes formatos, plataformas e incluso juegos.",
	},
	{
		title:
			"Amazon QuickSight: la bolita mágica que revela las tendencias de los platillos mexicanos",
		author: "Brenda Galicia",
		url: "https://builder.aws.com/content/31DAIHTTyQpGstNeYTZIJDPPF8Q/amazon-quicksight-la-bolita-magica-que-revela-las-tendencias-de-los-platillos-mexicanos",
		blurb:
			"Los datos también tienen sabor. Con Amazon QuickSight, aprenderemos cómo los datos revelan las tendencias de los platillos típicos mexicanos.",
	},
	{
		title: "AWS lanza su nueva capa gratuita",
		author: "David Victoria",
		url: "https://builder.aws.com/content/2zvRNS8S6oYdFZotYfuZfDcnA2j/aws-lanza-su-nueva-capa-gratuita-lo-que-debes-saber-lo-que-nadie-te-dice-y-por-que-es-buena-aunque-imperfecta",
		blurb:
			"El nuevo Free Tier de AWS, representa un paso en la dirección correcta: más claridad, enfoque educativo, y acceso a servicios clave.",
	},
	{
		title: "Más allá del Check-in: Usando IA y Vibe Coding",
		author: "Hector David Martinez Montilla",
		url: "https://builder.aws.com/content/3CMgTMtoT7Z2SVDml20197gZ2AL/mas-alla-del-check-in-usando-ia-y-vibe-coding-para-asombrar-a-nuestra-comunidad",
		blurb:
			"Todo gran MeetUp empieza desde la llegada, así usamos vibe coding para sorprender a nuestra comunidad geek.",
	},
	{
		title: "Todo lo nuevo de FinOps en AWS re:Invent 2025",
		author: "Barbara Gaspar",
		url: "https://builder.aws.com/content/36xbEYQNKtJis0lvljZgczbtVMr/todo-lo-nuevo-de-finops-en-aws-reinvent-2025",
		blurb:
			"Funcionalidades y actualizaciones de FinOps en AWS compartidas en AWS re:invent 2025.",
	},
	{
		title: "Modernización desde la mirada de un Platform Engineer",
		author: "Alex Parra",
		url: "https://builder.aws.com/content/2vAmGD3DOoPwHe9qgcmBV5AJg7T/modernizacion-desde-la-mirada-de-un-platform-engineer",
		blurb:
			"Una guía práctica para modernizar aplicaciones desde plataforma: estrategia, ejemplos reales y herramientas open source.",
	},
	{
		title: "Construir más allá del código",
		author: "David Victoria",
		url: "https://builder.aws.com/content/2uqAzjCPmlToCMYGslLuElriiSa/construir-mas-alla-del-codigo-cuando-la-comunidad-tech-conecta-con-el-mundo-emprendedor",
		blurb:
			"Nunca imaginé que hablar sobre LLMs frente a emprendedores no técnicos fuera tan poderoso.",
	},
];

/**
 * Fisher-Yates shuffle — bryan v0.0.0098: "rethink to have the order be
 * dynamic - keep the numbers as these will appear to rank & drive clicks
 * but actually it'll change each time we load the feed". The render
 * iterates with index → index+1 becomes the visible rank, but WHICH article
 * occupies which rank shuffles per page load. Module-level shuffle =
 * stable through the session (mirrors src/components/weather/cities.ts).
 */
function shuffle<T>(arr: readonly T[]): T[] {
	const out = arr.slice();
	for (let i = out.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[out[i], out[j]] = [out[j], out[i]];
	}
	return out;
}

// Combine + shuffle the entire English deck so any article can rank #1.
// First 4 of the shuffled order pin to primary, rest spill into carousel.
const EN_SHUFFLED: BuilderCenterCard[] = shuffle([
	...EN_PRIMARY,
	...EN_CAROUSEL,
]);
const EN_SHUFFLED_PRIMARY = EN_SHUFFLED.slice(0, 4);
const EN_SHUFFLED_CAROUSEL = EN_SHUFFLED.slice(4);

const MX_SHUFFLED: BuilderCenterCard[] = shuffle(MX_ALL);

// Locale-aware deck resolver. Each deck splits into 4 pinned + remainder
// carousel. Order shuffles per page load; ranks stay 1..N visually.
export function deckForLocale(locale: Locale): BuilderDeck {
	if (locale === "mx") {
		return {
			primary: MX_SHUFFLED.slice(0, 4),
			carousel: MX_SHUFFLED.slice(4),
		};
	}
	return { primary: EN_SHUFFLED_PRIMARY, carousel: EN_SHUFFLED_CAROUSEL };
}

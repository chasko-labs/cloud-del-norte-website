import Badge from "@cloudscape-design/components/badge";
import Box from "@cloudscape-design/components/box";
import ColumnLayout from "@cloudscape-design/components/column-layout";
import Container from "@cloudscape-design/components/container";
import ContentLayout from "@cloudscape-design/components/content-layout";
import ExpandableSection from "@cloudscape-design/components/expandable-section";
import Header from "@cloudscape-design/components/header";
import Link from "@cloudscape-design/components/link";
import SpaceBetween from "@cloudscape-design/components/space-between";
import StatusIndicator from "@cloudscape-design/components/status-indicator";
import Tabs from "@cloudscape-design/components/tabs";
import TextContent from "@cloudscape-design/components/text-content";
import { useEffect, useState } from "react";
import Breadcrumbs from "../../components/breadcrumbs";
import Navigation from "../../components/navigation";
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
import "./styles.css";

// ── code tab ─────────────────────────────────────────────────────────────────

function CodeTab() {
	return (
		<SpaceBetween size="l">
			<Container
				header={
					<Header
						variant="h2"
						description="languages, libraries, and tooling the site depends on"
					>
						the stack
					</Header>
				}
			>
				<ColumnLayout columns={3} variant="text-grid">
					<div>
						<Box variant="awsui-key-label">language</Box>
						<SpaceBetween size="xs">
							<div>TypeScript 6 — strict, no any</div>
							<div>React 19 — concurrent, hooks-first</div>
							<div>CSS — vanilla, custom properties</div>
							<div>GLSL — inline shader strings (babylon)</div>
							<div>Node 22 — build scripts (.mjs)</div>
						</SpaceBetween>
					</div>
					<div>
						<Box variant="awsui-key-label">key libraries</Box>
						<SpaceBetween size="xs">
							<div>Babylon.js 9 — 3D dune scene + star logo</div>
							<div>Cloudscape 3 — AWS design system</div>
							<div>fast-xml-parser — RSS + podcast feeds</div>
							<div>Vitest 4 + Testing Library — unit tests</div>
						</SpaceBetween>
					</div>
					<div>
						<Box variant="awsui-key-label">toolchain</Box>
						<SpaceBetween size="xs">
							<div>Vite 8 + Rollup — bundler</div>
							<div>Biome 2 — lint + format (no ESLint, no Prettier)</div>
							<div>tsc —noEmit — CI typecheck gate</div>
							<div>jsdom — test environment</div>
						</SpaceBetween>
					</div>
				</ColumnLayout>
			</Container>

			<Container
				header={
					<Header
						variant="h2"
						description="three independent SPAs built from one repo"
					>
						build pipeline
					</Header>
				}
			>
				<SpaceBetween size="s">
					<TextContent>
						<p>
							<code>npm run build</code> runs in sequence — pre-build scripts
							first, then three parallel vite passes:
						</p>
					</TextContent>
					<div className="cdn-plans-pipeline">
						<div className="cdn-plans-step">
							<span className="cdn-plans-step-num">1</span>
							<span>
								<strong>fetch-feeds.mjs</strong> — RSS + podcast episode
								metadata → <code>public/data/*.json</code> (server-side, no
								CORS)
							</span>
						</div>
						<div className="cdn-plans-step">
							<span className="cdn-plans-step-num">2</span>
							<span>
								<strong>fetch-releases.mjs</strong> — GitHub releases API →{" "}
								<code>releases.generated.json</code>
							</span>
						</div>
						<div className="cdn-plans-step">
							<span className="cdn-plans-step-num">3</span>
							<span>
								<strong>fetch-next-meetup.mjs</strong> — next meetup date
							</span>
						</div>
						<div className="cdn-plans-step">
							<span className="cdn-plans-step-num">4</span>
							<span>
								<strong>tsc</strong> — typecheck blocks on any type error
							</span>
						</div>
						<div className="cdn-plans-step">
							<span className="cdn-plans-step-num">5</span>
							<span>
								<strong>vite build</strong> → <code>lib/</code> — main site
								(feed, home, roadmap, meetings…)
							</span>
						</div>
						<div className="cdn-plans-step">
							<span className="cdn-plans-step-num">6</span>
							<span>
								<strong>vite build —config auth</strong> → <code>lib-auth/</code>{" "}
								— login, signup, verify, forgot-password
							</span>
						</div>
						<div className="cdn-plans-step">
							<span className="cdn-plans-step-num">7</span>
							<span>
								<strong>vite build —config awsug</strong> →{" "}
								<code>lib-awsug/</code> — aws user group subsite
							</span>
						</div>
					</div>
					<TextContent>
						<p>
							babylon.js chunks are split by module path (meshes, materials,
							shaders, engine…) so only changed chunks invalidate browser cache.
							HTML files get <code>no-cache</code>; hashed{" "}
							<code>/assets/*</code> get <code>immutable, max-age=31536000</code>
							.
						</p>
					</TextContent>
				</SpaceBetween>
			</Container>

			<Container
				header={
					<Header
						variant="h2"
						description="one account, four static sites, zero long-lived IAM keys"
					>
						aws architecture
					</Header>
				}
			>
				<SpaceBetween size="l">
					<ColumnLayout columns={2} variant="text-grid">
						<div>
							<Box variant="awsui-key-label">per-site pattern</Box>
							<TextContent>
								<p>
									each site gets a private S3 bucket (public access blocked)
									served exclusively via CloudFront OAC. ACM certificate in
									us-east-1. Route53 A record. four sites total: main,
									auth, dev, awsug.
								</p>
							</TextContent>
						</div>
						<div>
							<Box variant="awsui-key-label">zero long-lived keys</Box>
							<TextContent>
								<p>
									CI deploys via IAM RolesAnywhere — a workload x509 cert
									mounted into the CI agent authenticates via
									aws_signing_helper, assumes the deploy role, syncs S3,
									invalidates CloudFront. no <code>AWS_ACCESS_KEY_ID</code>{" "}
									anywhere.
								</p>
							</TextContent>
						</div>
					</ColumnLayout>

					<div>
						<Box variant="awsui-key-label" margin={{ bottom: "s" }}>
							estimated monthly cost (low-traffic)
						</Box>
						<div className="cdn-plans-cost-table">
							<div className="cdn-plans-cost-row cdn-plans-cost-header">
								<span>service</span>
								<span>role</span>
								<span>$/mo</span>
							</div>
							{[
								["S3 (4 buckets)", "static assets + CI screenshots", "~$0.50"],
								["CloudFront (4 dists)", "CDN, HTTPS, caching", "~$1–2"],
								["Route53", "DNS", "$0.50"],
								["ACM", "TLS certificates", "$0"],
								["Cognito", "auth — free tier covers ~50k MAU", "$0"],
								["EC2 bastion", "CI runner + WireGuard endpoint", "~$5–8"],
								["SNS", "deploy notifications", "~$0.01"],
								["total", "", "~$7–12"],
							].map(([svc, role, cost]) => (
								<div
									key={svc}
									className={`cdn-plans-cost-row${svc === "total" ? " cdn-plans-cost-total" : ""}`}
								>
									<span>{svc}</span>
									<span>{role}</span>
									<span>{cost}</span>
								</div>
							))}
						</div>
					</div>
				</SpaceBetween>
			</Container>

			<Container
				header={
					<Header
						variant="h2"
						description="three woodpecker pipelines, all self-hosted"
					>
						ci / cd
					</Header>
				}
			>
				<ColumnLayout columns={3} variant="text-grid">
					<div>
						<Box variant="awsui-key-label">ci.yml — quality gates</Box>
						<SpaceBetween size="xs">
							<div>biome — lint + format (error-level = fail)</div>
							<div>tsc —noEmit — typecheck</div>
							<div>npm run build — full build smoke test</div>
							<div>npm audit — high severity (failure: ignore)</div>
							<div>gitleaks — secret scan</div>
						</SpaceBetween>
					</div>
					<div>
						<Box variant="awsui-key-label">deploy.yml — S3 + CloudFront</Box>
						<SpaceBetween size="xs">
							<div>runs on push to main or dev</div>
							<div>auth chain: x509 cert → RolesAnywhere → deploy role</div>
							<div>two-pass sync: HTML (no-cache) + assets (immutable)</div>
							<div>liora/* excluded from —delete</div>
							<div>ntfy.sh + SNS on completion</div>
						</SpaceBetween>
					</div>
					<div>
						<Box variant="awsui-key-label">screenshot.yml — visual CI</Box>
						<SpaceBetween size="xs">
							<div>playwright captures after every deploy</div>
							<div>sleep 90s for CloudFront propagation</div>
							<div>
								screenshots at{" "}
								<code>
									dev.clouddelnorte.org/_ci/
									<wbr />
									screenshots/latest/
								</code>
							</div>
							<div>failure: ignore (informative, not blocking)</div>
						</SpaceBetween>
					</div>
				</ColumnLayout>
			</Container>

			<Container
				header={
					<Header variant="h2" description="how the station streams work">
						external apis
					</Header>
				}
			>
				<ColumnLayout columns={2} variant="text-grid">
					<div>
						<Box variant="awsui-key-label">AWS Cognito</Box>
						<div>
							auth flows (sign-in, sign-up, confirm, forgot/reset). pure SPA
							— no hosted UI. Cognito APIs called directly from
							auth.clouddelnorte.org.
						</div>
					</div>
					<div>
						<Box variant="awsui-key-label">Icecast / Zeno streams</Box>
						<div>
							live radio. player sets <code>&lt;audio src&gt;</code> directly.
							no proxy. stream URLs in <code>src/lib/streams.ts</code>. ~12
							live stations.
						</div>
					</div>
					<div>
						<Box variant="awsui-key-label">RSS podcast feeds</Box>
						<div>
							two paths: server-side at build (fetch-feeds.mjs) → no CORS; +
							client-side fallback at runtime. op3.dev proxies some episode
							audio URLs.
						</div>
					</div>
					<div>
						<Box variant="awsui-key-label">GitHub releases API</Box>
						<div>
							pre-build fetch of release notes → releases.generated.json
							(gitignored, generated at CI time). gracefully degrades without
							GITHUB_TOKEN.
						</div>
					</div>
					<div>
						<Box variant="awsui-key-label">YouTube oEmbed</Box>
						<div>meeting embed metadata resolution.</div>
					</div>
					<div>
						<Box variant="awsui-key-label">ntfy.sh</Box>
						<div>
							deploy push notifications to phone.{" "}
							<Link href="https://ntfy.sh" external variant="primary">
								ntfy.sh
							</Link>
						</div>
					</div>
				</ColumnLayout>
			</Container>

			<Container
				header={
					<Header variant="h2" description="the full quality gate sequence">
						code quality standards
					</Header>
				}
			>
				<SpaceBetween size="m">
					<TextContent>
						<p>
							<strong>biome</strong> is the single source of truth for lint +
							format. no ESLint, no Prettier. CI runs{" "}
							<code>biome ci —diagnostic-level=error</code> in parallel with
							install — it doesn't need node_modules.
						</p>
						<p>
							before committing, always run the full sequence:{" "}
							<code>
								npm run format:check → npm run lint → npx tsc —noEmit → npm
								test
							</code>
						</p>
						<p>
							tests live in <code>src/lib/__tests__/</code>. 400+ tests; all
							must pass. vitest excludes <code>.claude/worktrees/**</code>{" "}
							from discovery to avoid stale worktree pollution.
						</p>
					</TextContent>
					<ColumnLayout columns={2} variant="text-grid">
						<div>
							<Box variant="awsui-key-label">git workflow</Box>
							<SpaceBetween size="xs">
								<div>commit to dev first — never push directly to main</div>
								<div>dev deploys to dev.clouddelnorte.org automatically</div>
								<div>verify at dev, then merge dev → main</div>
								<div>main deploys to prod (all three sites)</div>
							</SpaceBetween>
						</div>
						<div>
							<Box variant="awsui-key-label">secrets pattern</Box>
							<SpaceBetween size="xs">
								<div>
									SSM Parameter Store at{" "}
									<code>/heraldstack/shared/</code>
								</div>
								<div>
									operator: <code>hs-secret load /heraldstack/shared</code>
								</div>
								<div>CI: x509 cert → RolesAnywhere (no plaintext keys)</div>
								<div>never .env files, never committed</div>
							</SpaceBetween>
						</div>
					</ColumnLayout>
				</SpaceBetween>
			</Container>
		</SpaceBetween>
	);
}

// ── agents tab ────────────────────────────────────────────────────────────────

function AgentsTab() {
	return (
		<SpaceBetween size="l">
			<Container
				header={
					<Header
						variant="h2"
						description="claude code CLI — shannon collective"
					>
						agent architecture
					</Header>
				}
			>
				<SpaceBetween size="m">
					<TextContent>
						<p>
							development runs on the{" "}
							<strong>heraldstack shannon collective</strong> — a multi-agent
							system on claude code CLI. the main thread plans and routes.
							subagents execute research, write code, verify visuals, and
							review PRs. anything taking more than 3 reads or queries is a
							candidate for agent dispatch.
						</p>
					</TextContent>
					<ColumnLayout columns={2} variant="text-grid">
						<div>
							<Box variant="awsui-key-label">Explore</Box>
							<div>
								fast read-only codebase search. use for "where is X defined?"
								or "which files reference Y?" — not for code review or
								multi-file analysis.
							</div>
						</div>
						<div>
							<Box variant="awsui-key-label">kerouac-web-researcher</Box>
							<div>
								web research. fetches docs, surveys design patterns, returns
								structured findings. always use before significant new
								features.
							</div>
						</div>
						<div>
							<Box variant="awsui-key-label">liora-headless-verifier</Box>
							<div>
								playwright chromium. navigates dev server, captures screenshots
								at 375/768/1280px. <strong>mandatory for any player change</strong>{" "}
								before commit.
							</div>
						</div>
						<div>
							<Box variant="awsui-key-label">stratia-pr-reviewer</Box>
							<div>
								posts github PR reviews as BryanChasko. review-only — returns
								APPROVE or REQUEST_CHANGES.
							</div>
						</div>
						<div>
							<Box variant="awsui-key-label">stratia-codebase-mapper</Box>
							<div>
								architecture mapper. use before any major refactor — produces
								dependency trees, import graphs, coupling hotspots.
							</div>
						</div>
						<div>
							<Box variant="awsui-key-label">orin-github-ops</Box>
							<div>
								the sole write agent for github. all push, PR, merge, and
								issue operations route here. main thread doesn't push directly.
							</div>
						</div>
					</ColumnLayout>
				</SpaceBetween>
			</Container>

			<Container
				header={
					<Header variant="h2" description="pre-authorized in settings.json">
						MCP servers
					</Header>
				}
			>
				<ColumnLayout columns={2} variant="text-grid">
					<div>
						<Box variant="awsui-key-label">context7</Box>
						<div>
							cloudscape + babylon.js docs. <strong>use this first</strong>{" "}
							before touching any cloudscape component or babylon API — training
							data is stale on recent versions. run resolve-library-id then
							query-docs.
						</div>
					</div>
					<div>
						<Box variant="awsui-key-label">qdrant-shared (port 8102)</Box>
						<div>
							shared project knowledge. semantic search across heraldstack
							docs and project history.
						</div>
					</div>
					<div>
						<Box variant="awsui-key-label">valkey (port 6379)</Box>
						<div>caching layer for agent outputs between sessions.</div>
					</div>
					<div>
						<Box variant="awsui-key-label">github MCP</Box>
						<div>
							issue, PR, repo operations. used by orin-github-ops for all
							write operations.
						</div>
					</div>
				</ColumnLayout>
			</Container>

			<Container
				header={
					<Header variant="h2" description="hooks that fire on session events">
						session hooks
					</Header>
				}
			>
				<ColumnLayout columns={3} variant="text-grid">
					<div>
						<Box variant="awsui-key-label">post-compact-context-reinject</Box>
						<div>
							fires after <code>/compact</code>. re-injects branch, stale
							branch warnings, and MCP service health into context. critical on
							long sessions — without it the model loses situational awareness
							after compaction.
						</div>
					</div>
					<div>
						<Box variant="awsui-key-label">session-start-motd</Box>
						<div>
							prints branch/commit/service health banner at session start.
							includes qdrant, valkey, jaeger health check.
						</div>
					</div>
					<div>
						<Box variant="awsui-key-label">user-prompt-submit-guard</Box>
						<div>
							runs verbal-tick and drift checks on every user message. enforces
							writing style standards (no "absolutely", no numbered lists where
							bullets suffice, etc).
						</div>
					</div>
				</ColumnLayout>
			</Container>

			<Container
				header={
					<Header
						variant="h2"
						description="the full gate sequence agents must pass before committing"
					>
						linting contract
					</Header>
				}
			>
				<SpaceBetween size="m">
					<TextContent>
						<p>
							agents must produce clean code before reporting a task done.
							types passing and tests green is necessary but not sufficient —
							visual changes also require playwright verification.
						</p>
					</TextContent>
					<div className="cdn-plans-pipeline">
						<div className="cdn-plans-step">
							<span className="cdn-plans-step-num">1</span>
							<span>
								<code>npm run format:check</code> — biome confirms formatting
								clean (no write flag in CI)
							</span>
						</div>
						<div className="cdn-plans-step">
							<span className="cdn-plans-step-num">2</span>
							<span>
								<code>npm run lint</code> — biome confirms no lint errors
							</span>
						</div>
						<div className="cdn-plans-step">
							<span className="cdn-plans-step-num">3</span>
							<span>
								<code>npx tsc —noEmit</code> — no type errors anywhere in{" "}
								<code>src/</code>
							</span>
						</div>
						<div className="cdn-plans-step">
							<span className="cdn-plans-step-num">4</span>
							<span>
								<code>npm test</code> — 400+ vitest tests, all green, no
								worktree pollution
							</span>
						</div>
						<div className="cdn-plans-step">
							<span className="cdn-plans-step-num">5</span>
							<span>
								playwright screenshots at 375/768/1280px — for any visual
								change (delegated to liora-headless-verifier)
							</span>
						</div>
					</div>
				</SpaceBetween>
			</Container>

			<Container
				header={
					<Header variant="h2" description="known pitfalls for agents new to this codebase">
						agent footguns
					</Header>
				}
			>
				<SpaceBetween size="s">
					<ExpandableSection headerText="CSS specificity on cloudscape tokens">
						<TextContent>
							<p>
								cloudscape uses obfuscated class names (<code>awsui_button_xyz</code>
								). our overrides use <code>[class*="awsui_button"]</code>{" "}
								attribute selectors. adding a new specificity level requires
								testing it doesn't accidentally lose to a cloudscape base rule.
								always scope light-mode-only overrides with{" "}
								<code>body:not(.awsui-dark-mode)</code>.
							</p>
						</TextContent>
					</ExpandableSection>
					<ExpandableSection headerText="liora assets are out-of-band">
						<TextContent>
							<p>
								<code>public/liora/</code> and <code>public/liora-embed/</code>{" "}
								are NOT in the repo. S3-managed separately. CI excludes them from{" "}
								<code>—delete</code> syncs. if liora isn't loading on the dev
								server, check <code>VITE_LIORA_SCRIPT_URL</code>.
							</p>
						</TextContent>
					</ExpandableSection>
					<ExpandableSection headerText="sparkle Hz safety budget">
						<TextContent>
							<p>
								<code>SPARKLE_SPEED_PLAYING</code> in{" "}
								<code>src/dune/white-sands-features.ts</code> must not exceed{" "}
								<strong>1.0</strong>. that's ~2 Hz sparkle. above 1.5 approaches
								the WCAG 2.3.1 / epilepsy foundation 3 Hz flash threshold. this
								value has a safety comment — respect it.
							</p>
						</TextContent>
					</ExpandableSection>
					<ExpandableSection headerText="vitest + jsdom vs. browser">
						<TextContent>
							<p>
								babylon.js will fail in jsdom (no WebGL). tests for dune scene
								code must mock the babylon engine. vitest excludes{" "}
								<code>.claude/worktrees/**</code> — stale worktrees would
								otherwise pollute the run with phantom failures.
							</p>
						</TextContent>
					</ExpandableSection>
				</SpaceBetween>
			</Container>
		</SpaceBetween>
	);
}

// ── backlog tab ───────────────────────────────────────────────────────────────

type Priority = "critical" | "in-progress" | "open";

interface BacklogItem {
	id: string;
	title: string;
	priority: Priority;
	files: string;
	summary: string;
}

const BACKLOG: BacklogItem[] = [
	{
		id: "S1",
		title: "liora-tube-off flash rate",
		priority: "critical",
		files: "src/components/liora-panel/styles.css:1607",
		summary:
			"FIXED 2026-05-04. extended 1.1s/5-cycle to 3.5s/2-cycle. max rate now ~1.8 Hz (was 6.5 Hz). WCAG 2.3.1 compliant.",
	},
	{
		id: "S2",
		title: "sparkle speed cap",
		priority: "critical",
		files: "src/dune/white-sands-features.ts:89",
		summary:
			"FIXED 2026-05-04. SPARKLE_SPEED_PLAYING 1.5 → 1.0 (~2 Hz, safe margin under 3 Hz threshold).",
	},
	{
		id: "A1",
		title: "side panels bleed into footer",
		priority: "open",
		files: "src/layouts/shell/styles.css",
		summary:
			"left nav bleeds into player/footer. right tools panel ends awkwardly above footer. add padding-bottom on navigation-container and tools-container equal to player height (~72px) + footer height (~48px).",
	},
	{
		id: "A2",
		title: "login page UX rethink",
		priority: "open",
		files: "src/sites/auth/_layout/index.tsx, styles.css",
		summary:
			"cloudscape form feels enterprise on a music app. three design alternatives documented: 'the postcard' (full-bleed dune, form as dark overlay strip), 'the command console' (dark glass, monospace), 'the desert entry' (no card, float form over tinted dune). near-term quick fix: raise card opacity to 0.72 + hide persistent player on auth pages.",
	},
	{
		id: "B1",
		title: "next button falls off screen on long titles",
		priority: "open",
		files: "src/components/persistent-player/styles.css",
		summary:
			"skip button needs flex-shrink: 0 in a right-anchored container. title area gets flex: 1 1 auto with min-width: 0. optionally add marquee scroll on long titles via scrollWidth > clientWidth detection.",
	},
	{
		id: "B2",
		title: "next station info under skip button",
		priority: "open",
		files: "src/components/persistent-player/index.tsx",
		summary:
			"under >>| button: show call sign / 4-letter key of next podcast + '&next' text so the 't' of 'next' aligns with '|' in >>|. derive nextStation from STREAMS array using same modulo as skipStation().",
	},
	{
		id: "B3",
		title: "scroll position lost on station skip",
		priority: "open",
		files: "src/components/persistent-player/index.tsx",
		summary:
			"navigating to next station scrolls page to top. capture window.scrollY before skip, restore after station mount. or use audio.focus({ preventScroll: true }).",
	},
	{
		id: "C1",
		title: "aws developers podcast broken",
		priority: "open",
		files: "src/lib/streams.ts:696, src/lib/streams-order.ts",
		summary:
			"go-aws.com DNS was SERVFAIL 2026-05-03. hidden: true added to stream entry; filtered in streams-order.ts shuffle. restore by removing hidden: true when DNS resolves.",
	},
	{
		id: "C2",
		title: "add aws latam podcast",
		priority: "open",
		files: "src/lib/streams.ts",
		summary:
			"verify the AWS LATAM podcast RSS feed URL before adding. add new entry following existing aws_podcast pattern. slot after last Spanish-language podcast entry.",
	},
	{
		id: "D1",
		title: "podcast resume position",
		priority: "open",
		files: "src/lib/player-persist.ts, src/components/persistent-player/index.tsx",
		summary:
			"extend PersistedPlayerState with podcastCurrentTime + podcastEpisodeUrl. save on timeupdate (throttled 5s). restore on loadedmetadata. use localStorage (not sessionStorage) for podcasts. clear on explicit episode skip.",
	},
	{
		id: "E1",
		title: "podcast player visual energy",
		priority: "open",
		files: "src/components/persistent-player/",
		summary:
			"podcast audio is monotone — audio-reactive CSS vars barely move. add: circular episode-art badge (40×40px) in transparent-left zone, time-ring progress (conic-gradient on currentTime/duration), tactile button feedback (scale(0.94) + overshoot easing on :active), waveform freeze-frame bars (cosmetic slow-breathe animation).",
	},
	{
		id: "F1",
		title: "donate label lowercase",
		priority: "open",
		files: "src/components/persistent-player/styles.css",
		summary:
			"source already renders '· donate' in lowercase. if live page shows 'DONATE', check for text-transform: uppercase on .cdn-pp__label-donate.",
	},
	{
		id: "G1",
		title: "dune too bouncy",
		priority: "open",
		files: "src/dune/white-sands-features.ts",
		summary:
			"MIGRATION_SPEED_MULTIPLIER = 3.0 may read as too aggressive. propose 1.5. fog, rim light, and phase-color transitions should do the visual work — not fast vertex displacement.",
	},
	{
		id: "G2",
		title: "sun stays still until music plays",
		priority: "open",
		files: "src/dune/AnimationController.ts",
		summary:
			"gate timeSeconds increment on isPlaying signal. when idle, freeze sun position and palette. resume on play. requires new signal path into AnimationController.update().",
	},
	{
		id: "H1",
		title: "liora console LED beat spec",
		priority: "open",
		files: "src/components/liora-panel/styles.css, index.tsx",
		summary:
			"LEDs fire every 4th beat alternating between 4 lights. requires JS-side beat detection from src/lib/background-viz/beat.ts → CSS var --cdn-beat-count → class toggle on each 4th beat.",
	},
	{
		id: "H2",
		title: "liora name typography — 70s retro",
		priority: "open",
		files: "src/components/liora-panel/styles.css",
		summary:
			"bold/condensed/italic 70s fonts: Cooper Black, Helvetica Condensed, ITC Serif Gothic, Kompakt. load via @font-face or CDN. test all four; confirm with bryan before shipping.",
	},
	{
		id: "I1",
		title: "name scroll fade-off character",
		priority: "open",
		files: "src/components/liora-panel/styles.css:2367",
		summary:
			"characters should fade transparent as they pass the right edge, not clip hard. use mask-image: linear-gradient(to right, transparent 0%, black 8%, black 85%, transparent 100%) on the scroll container.",
	},
	{
		id: "J1",
		title: "audio viz too much treble",
		priority: "open",
		files: "src/dune/DuneMaterial.ts, src/lib/background-viz/",
		summary:
			"for podcast mode: apply low-pass filter or reduce treble band weight before writing --cdn-treble. bass-driven shadows and slow ripples should dominate. moon rocks to baseline when podcast playing.",
	},
	{
		id: "K1",
		title: "dancer + speaker + radio tower icons",
		priority: "open",
		files: "src/components/ (new)",
		summary:
			"dancer: 24×32 SVG silhouette, thin brand-violet stroke, CSS sway animation. speaker: microphone-over-headphones composite. radio tower: Franklin Mountains ridge (jagged precambrian, 7192ft peak at upper-right), skinny mast, 3–4 crossbars, 0.5 Hz blink at tip. cross-reference franklin-overlay/path-builder.ts for existing ridge geometry.",
	},
];

function BacklogTab() {
	const byCritical = BACKLOG.filter((i) => i.priority === "critical");
	const byOpen = BACKLOG.filter((i) => i.priority === "open");

	const priorityLabel: Record<Priority, string> = {
		critical: "critical",
		"in-progress": "in progress",
		open: "open",
	};
	const priorityType: Record<
		Priority,
		"error" | "in-progress" | "pending"
	> = {
		critical: "error",
		"in-progress": "in-progress",
		open: "pending",
	};

	return (
		<SpaceBetween size="l">
			{byCritical.length > 0 && (
				<Container
					header={
						<Header
							variant="h2"
							counter={`(${byCritical.length})`}
							description="wcag 2.3.1 / epilepsy foundation — <3 Hz flash threshold"
						>
							<StatusIndicator type="error">safety — critical</StatusIndicator>
						</Header>
					}
				>
					<SpaceBetween size="s">
						{byCritical.map((item) => (
							<div key={item.id} className="cdn-plans-backlog-item">
								<div className="cdn-plans-backlog-meta">
									<Badge color="red">{item.id}</Badge>
									<StatusIndicator type={priorityType[item.priority]}>
										{priorityLabel[item.priority]}
									</StatusIndicator>
									<Box variant="code" fontSize="body-s">
										{item.files}
									</Box>
								</div>
								<Box variant="h4">{item.title}</Box>
								<TextContent>
									<p>{item.summary}</p>
								</TextContent>
							</div>
						))}
					</SpaceBetween>
				</Container>
			)}

			<Container
				header={
					<Header
						variant="h2"
						counter={`(${byOpen.length})`}
						description="prioritized by user impact — tackle in order"
					>
						open items
					</Header>
				}
			>
				<SpaceBetween size="s">
					{byOpen.map((item) => (
						<ExpandableSection
							key={item.id}
							headerText={
								<SpaceBetween size="s" direction="horizontal">
									<Badge
										color={
											item.id.startsWith("A") || item.id.startsWith("B")
												? "blue"
												: item.id.startsWith("C") || item.id.startsWith("D")
													? "green"
													: "grey"
										}
									>
										{item.id}
									</Badge>
									<span>{item.title}</span>
								</SpaceBetween>
							}
						>
							<SpaceBetween size="s">
								<Box variant="code" fontSize="body-s">
									{item.files}
								</Box>
								<TextContent>
									<p>{item.summary}</p>
								</TextContent>
							</SpaceBetween>
						</ExpandableSection>
					))}
				</SpaceBetween>
			</Container>
		</SpaceBetween>
	);
}

// ── shell ─────────────────────────────────────────────────────────────────────

function PlansContent() {
	useEffect(() => {
		document.title = "Plans — Cloud Del Norte";
	}, []);

	return (
		<ContentLayout
			header={
				<Header
					variant="h1"
					description="architecture, agents, and development guide for cloud del norte"
				>
					project plans
				</Header>
			}
		>
			<Tabs
				tabs={[
					{ label: "code", id: "code", content: <CodeTab /> },
					{ label: "agents", id: "agents", content: <AgentsTab /> },
					{ label: "backlog", id: "backlog", content: <BacklogTab /> },
				]}
			/>
		</ContentLayout>
	);
}

function BreadcrumbsContent() {
	return (
		<Breadcrumbs
			active={{ text: "plans", href: "/plans/index.html" }}
		/>
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
			breadcrumbs={<BreadcrumbsContent />}
			navigation={<Navigation />}
		>
			<PlansContent />
		</Shell>
	);
}

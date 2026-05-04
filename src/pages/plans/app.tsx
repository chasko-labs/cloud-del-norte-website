import Box from "@cloudscape-design/components/box";
import ColumnLayout from "@cloudscape-design/components/column-layout";
import Container from "@cloudscape-design/components/container";
import ContentLayout from "@cloudscape-design/components/content-layout";
import ExpandableSection from "@cloudscape-design/components/expandable-section";
import Header from "@cloudscape-design/components/header";
import Link from "@cloudscape-design/components/link";
import SpaceBetween from "@cloudscape-design/components/space-between";
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

// ── github tab ────────────────────────────────────────────────────────────────

function GithubTab() {
	return (
		<Container
			header={
				<Header
					variant="h2"
					description="issues, prs, and project tracking live on github — single source of truth"
				>
					github
				</Header>
			}
		>
			<ColumnLayout columns={2} variant="text-grid">
				<SpaceBetween size="s">
					<Box variant="awsui-key-label">repo</Box>
					<div>
						<Link
							href="https://github.com/chasko-labs/cloud-del-norte-website"
							external
						>
							chasko-labs/cloud-del-norte-website
						</Link>
					</div>
					<div>
						<Link
							href="https://github.com/chasko-labs/cloud-del-norte-website/issues"
							external
						>
							open issues
						</Link>
					</div>
					<div>
						<Link
							href="https://github.com/chasko-labs/cloud-del-norte-website/pulls"
							external
						>
							pull requests
						</Link>
					</div>
				</SpaceBetween>
				<SpaceBetween size="s">
					<Box variant="awsui-key-label">project board</Box>
					<div>
						<Link
							href="https://github.com/orgs/chasko-labs/projects"
							external
						>
							chasko-labs projects
						</Link>
					</div>
					<div>
						<Link
							href="https://github.com/chasko-labs/cloud-del-norte-website/milestones"
							external
						>
							milestones
						</Link>
					</div>
					<div>
						<Link
							href="https://github.com/chasko-labs/cloud-del-norte-website/actions"
							external
						>
							ci / actions
						</Link>
					</div>
				</SpaceBetween>
			</ColumnLayout>
		</Container>
	);
}

// ── shell ─────────────────────────────────────────────────────────────────────

function PlansContent() {
	useEffect(() => {
		document.title = "Website — Cloud Del Norte";
	}, []);

	return (
		<ContentLayout
			header={
				<Header
					variant="h1"
					description="architecture, agents, and development guide for cloud del norte"
				>
					website
				</Header>
			}
		>
			<Tabs
				tabs={[
					{ label: "code", id: "code", content: <CodeTab /> },
					{ label: "agents", id: "agents", content: <AgentsTab /> },
					{ label: "github", id: "github", content: <GithubTab /> },
				]}
			/>
		</ContentLayout>
	);
}

function BreadcrumbsContent() {
	return (
		<Breadcrumbs
			active={{ text: "website", href: "/plans/index.html" }}
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

import Alert from "@cloudscape-design/components/alert";
import Badge from "@cloudscape-design/components/badge";
import Box from "@cloudscape-design/components/box";
import Button from "@cloudscape-design/components/button";
import Container from "@cloudscape-design/components/container";
import ExpandableSection from "@cloudscape-design/components/expandable-section";
import Header from "@cloudscape-design/components/header";
import Link from "@cloudscape-design/components/link";
import SpaceBetween from "@cloudscape-design/components/space-between";
import StatusIndicator from "@cloudscape-design/components/status-indicator";
import { useCallback, useEffect, useRef, useState } from "react";
import CalendarActions from "../../../components/calendar-actions";
import { useTranslation } from "../../../hooks/useTranslation";
import { decodeToken, getIdToken } from "../../../lib/auth";
import {
	endMeeting,
	fetchInfrastructureStatus,
	fetchMeetingStatus,
	type InfraStatus,
	launchMeeting,
	type MeetingStatus,
} from "../../../lib/meetings";
import JitsiEmbed from "../../../pages/meetings/components/jitsi-embed";
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

const ROOM_NAME = "cloud-del-norte-awsug";
const SIGN_IN_URL =
	"https://auth.clouddelnorte.org/login/index.html?returnTo=https://quantum.clouddelnorte.org/auth-callback/%23return_to=/dashboard/";
const RECORDINGS_URL =
	"https://s3.console.aws.amazon.com/s3/buckets/cdn-jitsi-recordings?region=us-west-2&prefix=cloud-del-norte-awsug/";
const POLL_INTERVAL_MS = 30_000;
const CELEBRATION_DURATION_MS = 5_000;

interface UpcomingSession {
	title: string;
	date: string;
	time: string;
	description?: string;
	isoStart: string;
	isoEnd: string;
}

const UPCOMING_SESSIONS: UpcomingSession[] = [
	{
		title: "Test Call — Bryan & Amelia",
		date: "Wed Aug 12",
		time: "9:00 AM – 12:00 PM ET",
		isoStart: "2026-08-12T13:00:00Z",
		isoEnd: "2026-08-12T16:00:00Z",
	},
	{
		title: "Quantum Computing Workshop — Amazon Braket Part 1",
		date: "Sun Aug 30",
		time: "3:00–6:00 PM CDT",
		description: "Hands-on superpositions, wavefunctions, Deutsch's algorithm",
		isoStart: "2026-08-30T20:00:00Z",
		isoEnd: "2026-08-30T23:00:00Z",
	},
];

interface UserInfo {
	name: string;
	email: string;
	isModerator: boolean;
}

function getUserInfo(): UserInfo | null {
	const idToken = getIdToken();
	if (!idToken) return null;
	try {
		const payload = decodeToken(idToken);
		const groups = (payload["cognito:groups"] as string[] | undefined) ?? [];
		return {
			name:
				(payload["custom:display_name"] as string) ??
				(payload.name as string) ??
				(payload.email as string)?.split("@")[0] ??
				"",
			email: (payload.email as string) ?? "",
			isModerator: groups.includes("moderators"),
		};
	} catch {
		return null;
	}
}

function isRegistered(): boolean {
	try {
		return localStorage.getItem("cdn-quantum-registered") !== null;
	} catch {
		return false;
	}
}

function hasCelebrationShown(): boolean {
	try {
		return localStorage.getItem("cdn-quantum-celebration-shown") !== null;
	} catch {
		return false;
	}
}

function markCelebrationShown(): void {
	try {
		localStorage.setItem("cdn-quantum-celebration-shown", "true");
	} catch {
		// localStorage unavailable — non-critical
	}
}

/* ─── Wolf Celebration Banner ─── */

const celebrationStyles = `
@keyframes lobo-run {
	0% { transform: translateX(-100%); opacity: 0; }
	15% { opacity: 1; }
	100% { transform: translateX(0); opacity: 1; }
}
@keyframes lobo-fade-out {
	0% { opacity: 1; transform: translateY(0); }
	100% { opacity: 0; transform: translateY(-20px); }
}
@keyframes lobo-particle {
	0% { transform: translateY(0) scale(1); opacity: 1; }
	50% { opacity: 0.8; }
	100% { transform: translateY(-60px) scale(0.3); opacity: 0; }
}
@keyframes lobo-shimmer {
	0% { background-position: -200% center; }
	100% { background-position: 200% center; }
}
.lobo-celebration {
	position: relative;
	overflow: hidden;
	padding: 1.5rem 2rem;
	background: linear-gradient(135deg, #1a0a2e 0%, #2d1052 30%, #5a1f8a 60%, #9060f0 100%);
	border-radius: 12px;
	cursor: pointer;
	animation: lobo-run 0.8s ease-out forwards;
	border: 1px solid rgba(144, 96, 240, 0.3);
}
.lobo-celebration.dismissing {
	animation: lobo-fade-out 0.5s ease-in forwards;
}
.lobo-celebration__wolves {
	font-size: 2rem;
	letter-spacing: 0.3em;
	animation: lobo-run 1s ease-out forwards;
	animation-delay: 0.2s;
	opacity: 0;
}
.lobo-celebration__header {
	color: #fff;
	font-size: 1.5rem;
	font-weight: 700;
	margin: 0.5rem 0 0.25rem;
	background: linear-gradient(90deg, #fff, #d7c7ee, #fff);
	background-size: 200% auto;
	-webkit-background-clip: text;
	-webkit-text-fill-color: transparent;
	background-clip: text;
	animation: lobo-shimmer 3s linear infinite;
}
.lobo-celebration__body {
	color: rgba(215, 199, 238, 0.9);
	font-size: 0.95rem;
	margin: 0;
}
.lobo-celebration__particles {
	position: absolute;
	top: 0;
	left: 0;
	width: 100%;
	height: 100%;
	pointer-events: none;
	overflow: hidden;
}
.lobo-celebration__particle {
	position: absolute;
	font-size: 1.2rem;
	animation: lobo-particle 2.5s ease-out forwards;
}
@media (prefers-reduced-motion: reduce) {
	.lobo-celebration,
	.lobo-celebration__wolves,
	.lobo-celebration__header,
	.lobo-celebration__particle {
		animation: none !important;
		opacity: 1 !important;
		transform: none !important;
	}
	.lobo-celebration.dismissing { display: none; }
}
`;

function WolfCelebration({ onDismiss }: { onDismiss: () => void }) {
	const { t } = useTranslation();
	const [dismissing, setDismissing] = useState(false);
	const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	const dismiss = useCallback(() => {
		setDismissing(true);
		markCelebrationShown();
		setTimeout(onDismiss, 500);
	}, [onDismiss]);

	useEffect(() => {
		timerRef.current = setTimeout(dismiss, CELEBRATION_DURATION_MS);
		return () => {
			if (timerRef.current) clearTimeout(timerRef.current);
		};
	}, [dismiss]);

	const particles = Array.from({ length: 8 }, (_, i) => ({
		left: `${10 + i * 11}%`,
		delay: `${0.3 + i * 0.15}s`,
		emoji: i % 2 === 0 ? "🐺" : "✨",
	}));

	return (
		<>
			<style>{celebrationStyles}</style>
			<button
				type="button"
				className={`lobo-celebration${dismissing ? " dismissing" : ""}`}
				onClick={dismiss}
				aria-label={t("quantumDashboard.celebrationDismiss")}
				style={{
					textAlign: "left",
					width: "100%",
					font: "inherit",
				}}
			>
				<div className="lobo-celebration__particles">
					{particles.map((p) => (
						<span
							key={p.left}
							className="lobo-celebration__particle"
							style={{ left: p.left, animationDelay: p.delay, bottom: "10%" }}
						>
							{p.emoji}
						</span>
					))}
				</div>
				<div className="lobo-celebration__wolves">🐺 🐺 🐺 🐺 🐺</div>
				<p className="lobo-celebration__header">
					{t("quantumDashboard.celebrationHeader")}
				</p>
				<p className="lobo-celebration__body">
					{t("quantumDashboard.celebrationBody")}
				</p>
			</button>
		</>
	);
}

/* ─── Upcoming Sessions List ─── */

function getSessionStatus(
	session: UpcomingSession,
	now: Date,
): "live" | "today" | "upcoming" {
	const start = new Date(session.isoStart);
	const end = new Date(session.isoEnd);
	if (now >= start && now <= end) return "live";
	if (
		now.getUTCFullYear() === start.getUTCFullYear() &&
		now.getUTCMonth() === start.getUTCMonth() &&
		now.getUTCDate() === start.getUTCDate()
	)
		return "today";
	return "upcoming";
}

function UpcomingSessions({ onJoin }: { onJoin?: () => void }) {
	const { t } = useTranslation();
	const now = new Date();

	return (
		<Container
			header={
				<Header variant="h2">{t("quantumDashboard.sessionsHeader")}</Header>
			}
		>
			<SpaceBetween size="m">
				{UPCOMING_SESSIONS.map((session) => {
					const status = getSessionStatus(session, now);
					return (
						<SpaceBetween size="xxs" key={session.isoStart}>
							<SpaceBetween
								size="xs"
								direction="horizontal"
								alignItems="center"
							>
								<StatusIndicator
									type={
										status === "live"
											? "success"
											: status === "today"
												? "in-progress"
												: "pending"
									}
								>
									{status === "live"
										? t("quantumDashboard.statusLive")
										: status === "today"
											? t("quantumDashboard.statusToday")
											: t("quantumDashboard.statusUpcoming")}
								</StatusIndicator>
							</SpaceBetween>
							<Box fontWeight="bold">{session.title}</Box>
							<Box color="text-body-secondary">
								{session.date} · {session.time}
							</Box>
							{session.description && (
								<Box color="text-body-secondary" fontSize="body-s">
									{session.description}
								</Box>
							)}
							{status === "live" && onJoin && (
								<Button variant="primary" onClick={onJoin}>
									{t("quantumDashboard.joinButton")}
								</Button>
							)}
						</SpaceBetween>
					);
				})}
			</SpaceBetween>
		</Container>
	);
}

/* ─── Registered View (no Cognito token, but localStorage flag set) ─── */

function RegisteredView() {
	const { t } = useTranslation();
	const [showCelebration, setShowCelebration] = useState(
		() => !hasCelebrationShown(),
	);
	const [passkeyDismissed, setPasskeyDismissed] = useState(
		() => localStorage.getItem("cdn-quantum-passkey-dismissed") === "true",
	);

	const dismissPasskey = useCallback(() => {
		localStorage.setItem("cdn-quantum-passkey-dismissed", "true");
		setPasskeyDismissed(true);
	}, []);

	return (
		<SpaceBetween size="l">
			{showCelebration && (
				<WolfCelebration onDismiss={() => setShowCelebration(false)} />
			)}

			<Container
				header={
					<Header variant="h1">{t("quantumDashboard.registeredHeader")}</Header>
				}
			>
				<SpaceBetween size="m">
					<Alert type="info">{t("quantumDashboard.registeredInfo")}</Alert>
					<Box fontWeight="bold">{t("quantumDashboard.upcomingInfoDate")}</Box>
					<Box>{t("quantumDashboard.upcomingInfoTopic")}</Box>
					<Box color="text-body-secondary">
						{t("quantumDashboard.upcomingInfoStyle")}
					</Box>
					<CalendarActions />
					<Box color="text-body-secondary" fontSize="body-s">
						{t("quantumDashboard.registeredHosts")}
					</Box>
				</SpaceBetween>
			</Container>

			<UpcomingSessions />

			<Container
				header={
					<Header variant="h2">{t("quantumDashboard.joinOnEventDay")}</Header>
				}
			>
				<SpaceBetween size="s">
					<Box color="text-body-secondary">
						{t("quantumDashboard.joinOnEventDayBody")}
					</Box>
					<Box>
						<Link href="https://clouddelnorte.org/">
							{t("quantumDashboard.wantFullAccess")}
						</Link>
					</Box>
				</SpaceBetween>
			</Container>

			{!passkeyDismissed && (
				<Container
					header={
						<Header variant="h2">{t("quantumDashboard.passkeyOffer")}</Header>
					}
				>
					<SpaceBetween size="s">
						<Box color="text-body-secondary">
							{t("quantumDashboard.passkeyOfferBody")}
						</Box>
						<SpaceBetween direction="horizontal" size="s">
							<Button
								variant="primary"
								href="https://auth.clouddelnorte.org/passkeys/index.html"
								target="_blank"
							>
								{t("quantumDashboard.passkeyButton")}
							</Button>
							<Button variant="link" onClick={dismissPasskey}>
								{t("quantumDashboard.celebrationDismiss")}
							</Button>
						</SpaceBetween>
					</SpaceBetween>
				</Container>
			)}
		</SpaceBetween>
	);
}

/* ─── Guest View ─── */

function GuestView() {
	const { t } = useTranslation();
	return (
		<SpaceBetween size="l">
			<Container
				header={
					<Header variant="h1">{t("quantumDashboard.guestHeader")}</Header>
				}
			>
				<SpaceBetween size="m">
					<Box color="text-body-secondary" fontSize="heading-s">
						{t("quantumDashboard.guestSubtext")}
					</Box>
					<Box fontWeight="bold">{t("quantumDashboard.upcomingInfoDate")}</Box>
					<Box>{t("quantumDashboard.upcomingInfoTopic")}</Box>
					<Box color="text-body-secondary">
						{t("quantumDashboard.upcomingInfoStyle")}
					</Box>
					<Button variant="primary" href="/register/">
						{t("quantumDashboard.guestRegisterButton")}
					</Button>
				</SpaceBetween>
			</Container>

			<UpcomingSessions />

			<Box color="text-body-secondary" fontSize="body-s">
				<Link href={SIGN_IN_URL} fontSize="body-s">
					{t("quantumDashboard.guestSignInLink")}
				</Link>
			</Box>
		</SpaceBetween>
	);
}

/* ─── Session Status ─── */

function SessionStatus({
	status,
	onJoin,
}: {
	status: MeetingStatus | null;
	onJoin: () => void;
}) {
	const { t } = useTranslation();

	if (!status) {
		return (
			<StatusIndicator type="loading">
				{t("quantumDashboard.loadingStatus")}
			</StatusIndicator>
		);
	}

	if (status.live) {
		return (
			<SpaceBetween size="m">
				<SpaceBetween size="xs" direction="horizontal" alignItems="center">
					<Badge color="red">{t("quantumDashboard.liveBadge")}</Badge>
					<Box fontWeight="bold">{t("quantumDashboard.sessionInProgress")}</Box>
				</SpaceBetween>
				<Button variant="primary" onClick={onJoin}>
					{t("quantumDashboard.joinButton")}
				</Button>
			</SpaceBetween>
		);
	}

	if (status.scheduled.length > 0) {
		const next = status.scheduled[0];
		const scheduledDate = new Date(next.scheduledAt);
		const now = new Date();
		const diffMs = scheduledDate.getTime() - now.getTime();
		const diffHrs = Math.max(0, Math.floor(diffMs / 3_600_000));
		const diffMins = Math.max(0, Math.floor((diffMs % 3_600_000) / 60_000));

		return (
			<SpaceBetween size="s">
				<Box fontWeight="bold">
					{t("quantumDashboard.nextSession")}: {next.title}
				</Box>
				<Box>{scheduledDate.toLocaleString()}</Box>
				{diffMs > 0 && (
					<Box color="text-body-secondary">
						{t("quantumDashboard.startsIn")
							.replace("{{hours}}", String(diffHrs))
							.replace("{{minutes}}", String(diffMins))}
					</Box>
				)}
			</SpaceBetween>
		);
	}

	return (
		<StatusIndicator type="stopped">
			{t("quantumDashboard.noSessions")}
		</StatusIndicator>
	);
}

/* ─── Moderator Controls ─── */

function ModeratorControls() {
	const { t } = useTranslation();
	const [launching, setLaunching] = useState(false);
	const [ending, setEnding] = useState(false);
	const [infraStatus, setInfraStatus] = useState<InfraStatus | null>(null);
	const [actionError, setActionError] = useState("");
	const [actionSuccess, setActionSuccess] = useState("");

	useEffect(() => {
		let cancelled = false;
		const poll = async () => {
			try {
				const s = await fetchInfrastructureStatus();
				if (!cancelled) setInfraStatus(s);
			} catch {
				// non-critical — swallow
			}
		};
		poll();
		const id = setInterval(poll, POLL_INTERVAL_MS);
		return () => {
			cancelled = true;
			clearInterval(id);
		};
	}, []);

	const handleLaunch = async () => {
		setLaunching(true);
		setActionError("");
		setActionSuccess("");
		try {
			await launchMeeting({
				roomName: ROOM_NAME,
				title: "Quantum Workshop",
			});
			setActionSuccess(t("quantumDashboard.launchSuccess"));
		} catch (err) {
			setActionError(err instanceof Error ? err.message : "launch failed");
		} finally {
			setLaunching(false);
		}
	};

	const handleEnd = async () => {
		setEnding(true);
		setActionError("");
		setActionSuccess("");
		try {
			await endMeeting(ROOM_NAME);
			setActionSuccess(t("quantumDashboard.endSuccess"));
		} catch (err) {
			setActionError(err instanceof Error ? err.message : "end failed");
		} finally {
			setEnding(false);
		}
	};

	return (
		<ExpandableSection
			headerText={t("quantumDashboard.moderatorHeader")}
			variant="container"
		>
			<SpaceBetween size="m">
				{actionError && <Alert type="error">{actionError}</Alert>}
				{actionSuccess && <Alert type="success">{actionSuccess}</Alert>}
				<SpaceBetween size="xs" direction="horizontal">
					<Button variant="primary" loading={launching} onClick={handleLaunch}>
						{t("quantumDashboard.launchButton")}
					</Button>
					<Button loading={ending} onClick={handleEnd}>
						{t("quantumDashboard.endButton")}
					</Button>
				</SpaceBetween>
				<Box>
					<Box variant="awsui-key-label">
						{t("quantumDashboard.infraLabel")}
					</Box>
					{infraStatus ? (
						<StatusIndicator
							type={
								infraStatus.tasks_running >= infraStatus.tasks_desired
									? "success"
									: "in-progress"
							}
						>
							{infraStatus.cluster} — {infraStatus.tasks_running}/
							{infraStatus.tasks_desired} {t("quantumDashboard.tasksRunning")}
						</StatusIndicator>
					) : (
						<StatusIndicator type="loading">
							{t("quantumDashboard.loadingInfra")}
						</StatusIndicator>
					)}
				</Box>
				<Button
					variant="link"
					href={RECORDINGS_URL}
					target="_blank"
					iconName="external"
				>
					{t("quantumDashboard.viewRecordings")}
				</Button>
			</SpaceBetween>
		</ExpandableSection>
	);
}

/* ─── Member View (authenticated) ─── */

function MemberView({ user }: { user: UserInfo }) {
	const { t } = useTranslation();
	const [meetingStatus, setMeetingStatus] = useState<MeetingStatus | null>(
		null,
	);
	const [joined, setJoined] = useState(false);
	const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

	const pollStatus = useCallback(async () => {
		try {
			const s = await fetchMeetingStatus();
			setMeetingStatus(s);
		} catch {
			// non-critical — keep polling
		}
	}, []);

	useEffect(() => {
		pollStatus();
		pollRef.current = setInterval(pollStatus, POLL_INTERVAL_MS);
		return () => {
			if (pollRef.current) clearInterval(pollRef.current);
		};
	}, [pollStatus]);

	const handleJoin = () => setJoined(true);
	const handleClose = () => setJoined(false);

	if (joined) {
		return (
			<div className="quantum-immersive">
				<Box padding={{ top: "xs", horizontal: "s" }}>
					<Button variant="link" onClick={handleClose} iconName="close">
						{t("quantumDashboard.exitSession")}
					</Button>
				</Box>
				<JitsiEmbed roomName={ROOM_NAME} onClose={handleClose} />
			</div>
		);
	}

	return (
		<SpaceBetween size="l">
			<Container
				header={
					<Header
						variant="h1"
						description={t("quantumDashboard.memberSubheader")}
					>
						{t("quantumDashboard.memberHeader")}
					</Header>
				}
			>
				<SpaceBetween size="m">
					<SessionStatus status={meetingStatus} onJoin={handleJoin} />
					<CalendarActions />
				</SpaceBetween>
			</Container>

			<UpcomingSessions onJoin={handleJoin} />

			{user.isModerator && <ModeratorControls />}
		</SpaceBetween>
	);
}

/* ─── Dashboard Content (state router) ─── */

function DashboardContent() {
	const [user, setUser] = useState<UserInfo | null>(null);
	const [checked, setChecked] = useState(false);

	useEffect(() => {
		setUser(getUserInfo());
		setChecked(true);
	}, []);

	if (!checked) return null;

	// Authenticated user → full member view
	if (user) return <MemberView user={user} />;

	// Registered via form (localStorage flag) but no Cognito token → registered view
	if (isRegistered()) return <RegisteredView />;

	// No token, no registration → guest view
	return <GuestView />;
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
			<DashboardContent />
		</QuantumLayout>
	);
}

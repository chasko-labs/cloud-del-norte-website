import Alert from "@cloudscape-design/components/alert";
import Badge from "@cloudscape-design/components/badge";
import Box from "@cloudscape-design/components/box";
import Button from "@cloudscape-design/components/button";
import Container from "@cloudscape-design/components/container";
import ExpandableSection from "@cloudscape-design/components/expandable-section";
import Header from "@cloudscape-design/components/header";
import SpaceBetween from "@cloudscape-design/components/space-between";
import StatusIndicator from "@cloudscape-design/components/status-indicator";
import { useCallback, useEffect, useRef, useState } from "react";
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
					<Button variant="primary" href={SIGN_IN_URL}>
						{t("quantumDashboard.signInButton")}
					</Button>
				</SpaceBetween>
			</Container>
			<Container
				header={
					<Header variant="h2">
						{t("quantumDashboard.upcomingInfoHeader")}
					</Header>
				}
			>
				<SpaceBetween size="s">
					<Box fontWeight="bold">{t("quantumDashboard.upcomingInfoDate")}</Box>
					<Box>{t("quantumDashboard.upcomingInfoTopic")}</Box>
					<Box color="text-body-secondary">
						{t("quantumDashboard.upcomingInfoStyle")}
					</Box>
				</SpaceBetween>
			</Container>
		</SpaceBetween>
	);
}

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
				<SessionStatus status={meetingStatus} onJoin={handleJoin} />
			</Container>

			{user.isModerator && <ModeratorControls />}
		</SpaceBetween>
	);
}

function DashboardContent() {
	const [user, setUser] = useState<UserInfo | null>(null);
	const [checked, setChecked] = useState(false);

	useEffect(() => {
		setUser(getUserInfo());
		setChecked(true);
	}, []);

	if (!checked) return null;

	if (!user) return <GuestView />;

	return <MemberView user={user} />;
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

import Box from "@cloudscape-design/components/box";
import Button from "@cloudscape-design/components/button";
import Container from "@cloudscape-design/components/container";
import Header from "@cloudscape-design/components/header";
import SpaceBetween from "@cloudscape-design/components/space-between";
import Spinner from "@cloudscape-design/components/spinner";
import { useEffect, useState } from "react";

const API_BASE = "https://rwmypxz9z6.execute-api.us-west-2.amazonaws.com";

function getHash(): string {
	// URL: /m/<hash> or /meeting-public/index.html?hash=<hash>
	const path = window.location.pathname;
	const match = path.match(/\/m\/([a-f0-9]{32})/);
	if (match) return match[1];
	return new URLSearchParams(window.location.search).get("hash") ?? "";
}

interface Meeting {
	title: string;
	scheduled_start: string;
	duration_minutes: number;
	description: string;
	room_hash: string;
}

export default function App() {
	const [meeting, setMeeting] = useState<Meeting | null>(null);
	const [error, setError] = useState("");
	const [loading, setLoading] = useState(true);
	const [countdown, setCountdown] = useState("");
	const [canJoin, setCanJoin] = useState(false);

	const hash = getHash();

	useEffect(() => {
		if (!hash) {
			setError("invalid meeting link");
			setLoading(false);
			return;
		}
		fetch(`${API_BASE}/m/${hash}`)
			.then((r) => (r.ok ? r.json() : Promise.reject("not found")))
			.then(setMeeting)
			.catch(() => setError("meeting not found or no longer available"))
			.finally(() => setLoading(false));
	}, [hash]);

	useEffect(() => {
		if (!meeting) return;
		const interval = setInterval(() => {
			const start = new Date(meeting.scheduled_start).getTime();
			const now = Date.now();
			const diff = start - now;
			if (diff <= 15 * 60000) {
				setCanJoin(true);
				setCountdown(diff > 0 ? "starting soon" : "live now");
			} else {
				setCanJoin(false);
				const h = Math.floor(diff / 3600000);
				const m = Math.floor((diff % 3600000) / 60000);
				setCountdown(h > 0 ? `starts in ${h}h ${m}m` : `starts in ${m}m`);
			}
		}, 1000);
		return () => clearInterval(interval);
	}, [meeting]);

	if (loading)
		return (
			<Box textAlign="center" padding="xxl">
				<Spinner size="large" />
			</Box>
		);
	if (error)
		return (
			<Box textAlign="center" padding="xxl" color="text-status-error">
				{error}
			</Box>
		);
	if (!meeting) return null;

	return (
		<Box padding="xxl">
			<SpaceBetween size="l">
				<Container header={<Header variant="h1">{meeting.title}</Header>}>
					<SpaceBetween size="m">
						<Box variant="p">{meeting.description}</Box>
						<Box>
							<strong>
								{new Date(meeting.scheduled_start).toLocaleString()}
							</strong>{" "}
							· {meeting.duration_minutes} min
						</Box>
						<Box
							fontSize="heading-l"
							fontWeight="bold"
							color={canJoin ? "text-status-success" : "text-status-inactive"}
						>
							{countdown}
						</Box>
						<Button
							variant="primary"
							disabled={!canJoin}
							href={`https://meet.clouddelnorte.org/cdn-meeting-${hash.slice(0, 12)}`}
						>
							join call
						</Button>
					</SpaceBetween>
				</Container>
			</SpaceBetween>
		</Box>
	);
}

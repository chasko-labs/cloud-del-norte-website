import { useEffect, useState } from "react";

type CountdownState = "hidden" | "soon" | string;

function compute(dtstart: string): CountdownState {
	const diff = new Date(dtstart).getTime() - Date.now();
	if (diff <= 0) return "hidden";
	if (diff < 5 * 60 * 1000) return "soon";
	const d = Math.floor(diff / 86_400_000);
	const h = Math.floor((diff % 86_400_000) / 3_600_000);
	const m = Math.floor((diff % 3_600_000) / 60_000);
	const parts: string[] = [];
	if (d) parts.push(`${d}d`);
	if (h) parts.push(`${h}h`);
	parts.push(`${m}m`);
	return `next meetup in ${parts.join(" ")}`;
}

export default function NextMeetupCountdown() {
	const [state, setState] = useState<CountdownState>("hidden");

	useEffect(() => {
		let cancelled = false;
		let intervalId: ReturnType<typeof setInterval> | null = null;

		fetch("/data/next-meetup.json")
			.then((r) => (r.ok ? r.json() : null))
			.then((data: { dtstart?: string } | null) => {
				if (cancelled || !data?.dtstart) return;
				const dtstart = data.dtstart;
				setState(compute(dtstart));
				intervalId = setInterval(() => {
					if (!cancelled) setState(compute(dtstart));
				}, 30_000);
			})
			.catch(() => {
				/* missing file → stay hidden */
			});

		return () => {
			cancelled = true;
			if (intervalId !== null) clearInterval(intervalId);
		};
	}, []);

	if (state === "hidden") return null;
	return (
		<span className="cdn-footer-countdown">
			{state === "soon" ? "— STARTING SOON —" : state}
		</span>
	);
}

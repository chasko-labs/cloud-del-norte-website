import { useEffect, useState } from "react";
import "./time-of-day-bar.css";

/** Position-primary time-of-day indicator. Sun/moon glyph at horizontal
 *  coordinate = (localHour + localMinute/60) / 24. */
export default function TimeOfDayBar() {
	const [now, setNow] = useState(() => new Date());

	useEffect(() => {
		const id = setInterval(() => setNow(new Date()), 60_000);
		return () => clearInterval(id);
	}, []);

	const hour = now.getHours();
	const minute = now.getMinutes();
	const pct = ((hour + minute / 60) / 24) * 100;
	const isDaytime = hour >= 6 && hour < 18;

	return (
		<div
			className="cdn-tod-bar"
			role="img"
			aria-label={`Time of day: ${hour.toString().padStart(2, "0")}:${minute.toString().padStart(2, "0")} local`}
		>
			<div className="cdn-tod-bar__track">
				<span
					className="cdn-tod-bar__glyph"
					style={{ left: `${pct}%` }}
					aria-hidden="true"
				>
					{isDaytime ? "☀" : "☽"}
				</span>
			</div>
		</div>
	);
}

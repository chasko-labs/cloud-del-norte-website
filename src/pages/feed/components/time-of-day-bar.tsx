import { useEffect, useState } from "react";
import { elPasoHour } from "../../../lib/time-of-day";
import "./time-of-day-bar.css";

/** Position-primary time-of-day indicator. Sun/moon glyph at horizontal
 *  coordinate = (elPasoHour + minute/60) / 24. */
export default function TimeOfDayBar() {
	const [hour, setHour] = useState(() => elPasoHour());
	const [minute, setMinute] = useState(() => new Date().getUTCMinutes());

	useEffect(() => {
		const id = setInterval(() => {
			setHour(elPasoHour());
			setMinute(new Date().getUTCMinutes());
		}, 60_000);
		return () => clearInterval(id);
	}, []);

	const pct = ((hour + minute / 60) / 24) * 100;
	const isDaytime = hour >= 6 && hour < 18;

	return (
		<div
			className="cdn-tod-bar"
			role="img"
			aria-label={`Time of day: ${hour.toString().padStart(2, "0")}:${minute.toString().padStart(2, "0")} El Paso`}
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

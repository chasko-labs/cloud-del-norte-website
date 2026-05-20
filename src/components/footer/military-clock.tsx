import { useEffect, useState } from "react";

function nowElPaso(): string {
	return new Intl.DateTimeFormat("en-US", {
		timeZone: "America/Denver",
		hour: "2-digit",
		minute: "2-digit",
		second: "2-digit",
		hour12: false,
	}).format(new Date());
}

export default function MilitaryClock() {
	const [time, setTime] = useState(nowElPaso);

	useEffect(() => {
		const id = setInterval(() => setTime(nowElPaso()), 1000);
		return () => clearInterval(id);
	}, []);

	return (
		<span
			className="cdn-footer-clock"
			role="timer"
			aria-label="current time in el paso"
		>
			{time}
		</span>
	);
}

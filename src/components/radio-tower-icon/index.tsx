import "./styles.css";

export function RadioTowerIcon({ active = false }: { active?: boolean }) {
	return (
		<svg
			viewBox="0 0 24 24"
			width="24"
			height="24"
			fill="none"
			stroke="currentColor"
			strokeWidth="1.5"
			strokeLinecap="round"
			strokeLinejoin="round"
			className={
				active
					? "cdn-radio-tower-icon cdn-radio-tower-icon--active"
					: "cdn-radio-tower-icon"
			}
			aria-hidden="true"
		>
			{/* antenna tip circle */}
			<circle cx="12" cy="3" r="1" />
			{/* vertical mast */}
			<line x1="12" y1="4" x2="12" y2="22" />
			{/* cross-braces */}
			<line x1="9" y1="9" x2="15" y2="9" />
			<line x1="12" y1="9" x2="9" y2="15" />
			<line x1="12" y1="9" x2="15" y2="15" />
			<line x1="7" y1="15" x2="17" y2="15" />
			<line x1="12" y1="15" x2="7" y2="22" />
			<line x1="12" y1="15" x2="17" y2="22" />
			{/* broadcast waves */}
			<path className="cdn-radio-tower-icon__wave" d="M15 5 Q18 3 15 1" />
			<path className="cdn-radio-tower-icon__wave" d="M17 6 Q21 3 17 0" />
			<path className="cdn-radio-tower-icon__wave" d="M9 5 Q6 3 9 1" />
			<path className="cdn-radio-tower-icon__wave" d="M7 6 Q3 3 7 0" />
		</svg>
	);
}

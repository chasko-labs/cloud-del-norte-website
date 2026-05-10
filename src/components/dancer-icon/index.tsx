import "./styles.css";

export function DancerIcon({ animate = false }: { animate?: boolean }) {
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
				animate ? "cdn-dancer-icon cdn-dancer-icon--sway" : "cdn-dancer-icon"
			}
			aria-hidden="true"
		>
			{/* head */}
			<circle cx="12" cy="4" r="2" />
			{/* body */}
			<path d="M12 6 L12 14" />
			{/* arms raised */}
			<path d="M12 8 Q9 5 7 3" />
			<path d="M12 8 Q15 5 17 3" />
			{/* legs - flowing */}
			<path d="M12 14 Q10 18 8 22" />
			<path d="M12 14 Q14 17 16 21" />
			{/* flowing skirt hint */}
			<path d="M10 12 Q12 13 14 12" />
		</svg>
	);
}

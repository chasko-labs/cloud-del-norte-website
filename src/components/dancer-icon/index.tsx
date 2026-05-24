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
			{/* arms — flowing Q bezier curves */}
			<path d="M12 8 Q8 4 6 2" />
			<path d="M12 8 Q16 6 18 4" />
			{/* legs */}
			<path d="M12 14 Q10 18 8 22" />
			<path d="M12 14 Q14 17 16 21" />
			{/* skirt hint */}
			<path d="M10 12 Q12 13 14 12" />
			{/* motion trail behind leading leg */}
			<path className="cdn-dancer-icon__trail" d="M12 14 Q13 17 15 20" />
		</svg>
	);
}

import "./styles.css";

export function SpeakerIcon() {
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
			className="cdn-speaker-icon"
			aria-hidden="true"
		>
			{/* head */}
			<circle cx="12" cy="4" r="2" />
			{/* body */}
			<line x1="12" y1="6" x2="12" y2="12" />
			{/* arm forward gesturing */}
			<path d="M12 9 Q15 8 17 7" />
			{/* arm back */}
			<path d="M12 9 L10 11" />
			{/* podium trapezoid */}
			<path d="M9 13 L15 13 L17 20 L7 20 Z" />
			{/* podium face */}
			<line x1="7" y1="20" x2="17" y2="20" />
			{/* speech wave 1 */}
			<path d="M15 3 Q17 4 15 5" />
			{/* speech wave 2 */}
			<path d="M16 2 Q19 4 16 6" />
		</svg>
	);
}

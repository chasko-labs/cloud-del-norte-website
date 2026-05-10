import "./styles.css";

/** Headphones-over-microphone icon for podcast mode */
export function PodcastIcon() {
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
			className="cdn-podcast-icon"
			aria-hidden="true"
		>
			{/* headphone band */}
			<path d="M4 15V12a8 8 0 0 1 16 0v3" />
			{/* left ear cup */}
			<rect x="2" y="14" width="4" height="6" rx="1" />
			{/* right ear cup */}
			<rect x="18" y="14" width="4" height="6" rx="1" />
			{/* mic below center */}
			<line x1="12" y1="18" x2="12" y2="22" />
			<circle cx="12" cy="17" r="2" />
		</svg>
	);
}

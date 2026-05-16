import "./styles.css";

/** k4 — headphones-over-microphone composite icon for podcast mode indicator */
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
			{/* mic body — classic capsule, lower-center, partially behind headphone band */}
			<rect x="9.5" y="10" width="5" height="7" rx="2.5" />
			{/* mic stand stem */}
			<line x1="12" y1="17" x2="12" y2="21" />
			{/* mic stand base */}
			<line x1="9" y1="21" x2="15" y2="21" />
			{/* headphone band — U-arc over the top, crossing in front of mic */}
			<path d="M4 14V11a8 8 0 0 1 16 0v3" />
			{/* left ear cup */}
			<rect x="2" y="13" width="4" height="5" rx="1.5" />
			{/* right ear cup */}
			<rect x="18" y="13" width="4" height="5" rx="1.5" />
			{/* accent: small dynamic line on mic capsule body */}
			<line x1="11" y1="13" x2="13" y2="13" />
		</svg>
	);
}

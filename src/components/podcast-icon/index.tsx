import "./styles.css";

/** Redesigned headphones-over-microphone composite icon for podcast mode indicator */
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
			{/* broadcast dot — top of headphone band */}
			<circle
				cx="12"
				cy="3"
				r="1.5"
				fill="currentColor"
				stroke="none"
				className="cdn-podcast-icon__dot"
			/>
			{/* headphone band — smooth arc */}
			<path d="M4.5 13.5A7.5 7.5 0 0 1 12 4.5a7.5 7.5 0 0 1 7.5 9" />
			{/* left ear cup — rounded ellipse */}
			<ellipse cx="3.5" cy="15" rx="1.5" ry="2.5" />
			{/* right ear cup — rounded ellipse */}
			<ellipse cx="20.5" cy="15" rx="1.5" ry="2.5" />
			{/* mic capsule — slender rounded rect */}
			<rect x="10" y="11" width="4" height="6" rx="2" />
			{/* mic stem */}
			<line x1="12" y1="17" x2="12" y2="20" />
			{/* mic base */}
			<line x1="10" y1="20" x2="14" y2="20" />
			{/* sound wave — inner arc */}
			<path d="M8.5 14.5a3.5 3.5 0 0 0 0 3" />
			{/* sound wave — outer arc */}
			<path d="M7 13a5.5 5.5 0 0 0 0 6" />
		</svg>
	);
}

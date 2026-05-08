import "./styles.css";

export default function SpeakeasySign() {
	return (
		<div className="speakeasy-sign" aria-label="speakeasy">
			<svg
				viewBox="0 0 180 44"
				xmlns="http://www.w3.org/2000/svg"
				role="img"
				aria-hidden="true"
			>
				<defs>
					<filter id="speakeasy-glow">
						<feGaussianBlur stdDeviation="1" result="g1" />
						<feGaussianBlur stdDeviation="3.5" result="g2" />
						<feGaussianBlur stdDeviation="8" result="g3" />
						<feMerge>
							<feMergeNode in="g3" />
							<feMergeNode in="g2" />
							<feMergeNode in="g1" />
							<feMergeNode in="SourceGraphic" />
						</feMerge>
					</filter>
				</defs>
				<g
					filter="url(#speakeasy-glow)"
					fill="none"
					stroke="#e8a040"
					strokeWidth="2.5"
					strokeLinecap="round"
					strokeLinejoin="round"
				>
					{/* s */}
					<path d="M8 20c4-6 12-6 12 0s-10 6-10 12c0 4 8 4 12 0" />
					{/* p */}
					<path d="M28 16v20M28 18c6-4 14-2 12 6s-10 8-12 4" />
					{/* e */}
					<path d="M48 26c8-2 8-10 0-8c-6 2-6 12 2 12c4 0 6-2 6-4" />
					{/* a */}
					<path d="M64 20c8-4 12 2 10 8c-2 6-8 6-10 4v-12c0 8 2 12 10 10" />
					{/* k */}
					<path
						className="speakeasy-flicker"
						d="M82 12v24M82 24l8-8M86 20l8 12"
					/>
					{/* e */}
					<path d="M100 26c8-2 8-10 0-8c-6 2-6 12 2 12c4 0 6-2 6-4" />
					{/* a */}
					<path d="M116 20c8-4 12 2 10 8c-2 6-8 6-10 4v-12c0 8 2 12 10 10" />
					{/* s */}
					<path d="M136 20c4-6 10-6 10 0s-8 6-8 10c0 4 8 4 10 0" />
					{/* y */}
					<path d="M154 18l6 14M166 18l-8 18c-2 6-6 8-10 6" />
				</g>
			</svg>
		</div>
	);
}

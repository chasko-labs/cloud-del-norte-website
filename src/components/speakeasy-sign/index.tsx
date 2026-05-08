import "./styles.css";

export default function SpeakeasySign() {
	return (
		<div className="speakeasy-sign" aria-label="speakeasy">
			<svg
				viewBox="0 0 120 24"
				xmlns="http://www.w3.org/2000/svg"
				role="img"
				aria-hidden="true"
			>
				<defs>
					<filter id="speakeasy-tube" x="-50%" y="-50%" width="200%" height="200%" colorInterpolationFilters="sRGB">
						<feGaussianBlur in="SourceGraphic" stdDeviation="1.5" result="tight" />
						<feGaussianBlur in="SourceGraphic" stdDeviation="4" result="wide" />
						<feMerge>
							<feMergeNode in="wide" />
							<feMergeNode in="tight" />
							<feMergeNode in="SourceGraphic" />
						</feMerge>
					</filter>
				</defs>
				<text
					className="speakeasy-text"
					x="60"
					y="17"
					textAnchor="middle"
					fill="#c8a0ff"
					filter="url(#speakeasy-tube)"
					fontFamily="system-ui, -apple-system, sans-serif"
					fontSize="13"
					fontWeight="300"
					letterSpacing="0.15em"
				>
					speakeasy
				</text>
			</svg>
		</div>
	);
}

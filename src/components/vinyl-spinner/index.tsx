import "./styles.css";

interface VinylSpinnerProps {
	spinning?: boolean;
	audioReactive?: boolean;
	className?: string;
}

export function VinylSpinner({
	spinning,
	audioReactive,
	className,
}: VinylSpinnerProps) {
	const classes = [
		"cdn-vinyl",
		spinning && "cdn-vinyl--spinning",
		audioReactive && "cdn-vinyl--audio-reactive",
		className,
	]
		.filter(Boolean)
		.join(" ");

	return (
		<div className={classes}>
			<div className="cdn-vinyl__grooves" />
			<div className="cdn-vinyl__label" />
			<div className="cdn-vinyl__highlight" />
		</div>
	);
}

export default VinylSpinner;

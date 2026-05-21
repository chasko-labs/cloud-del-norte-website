import Weather from "../weather";
import MilitaryClock from "./military-clock";
import NextMeetupCountdown from "./next-meetup-countdown";
import "./styles.css";

export default function Footer() {
	return (
		<>
			{/* Wave 70c: spacer reserves space so page content doesn't hide behind fixed footer */}
			<div className="cdn-footer-spacer" aria-hidden="true" />
			<footer id="site-footer" className="cdn-footer" role="contentinfo">
				<div className="cdn-footer-bar">
					<div className="cdn-footer-left">
						<MilitaryClock />
						<NextMeetupCountdown />
					</div>
					<div className="cdn-footer-weather">
						<Weather />
					</div>
					<span className="cdn-version">0.0.0147</span>
				</div>
			</footer>
		</>
	);
}

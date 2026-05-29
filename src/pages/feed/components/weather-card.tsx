import Weather from "../../../components/weather";
import "./weather-card.css";

/** Feed-page weather card — wraps the existing Weather component in a
 *  glass card surface. Icon + numeric data primary, desaturated accent. */
export default function WeatherCard() {
	return (
		<div className="cdn-feed-weather-card">
			<Weather />
		</div>
	);
}

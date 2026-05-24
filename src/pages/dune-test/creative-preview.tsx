import { LoadingAtmosphere } from "../../components/cdn-loading-atmosphere";
import { DancerIcon } from "../../components/dancer-icon";
import { PodcastIcon } from "../../components/podcast-icon";
import { RadioTowerIcon } from "../../components/radio-tower-icon";
import { SpeakerIcon } from "../../components/speaker-icon";
import { VinylSpinner } from "../../components/vinyl-spinner";
import "../../styles/tokens.css";

const section = {
	display: "flex",
	gap: "24px",
	alignItems: "center",
	padding: "24px",
	flexWrap: "wrap" as const,
};
const label = {
	fontSize: "12px",
	color: "#666",
	marginTop: "4px",
	textAlign: "center" as const,
};
const box = {
	display: "flex",
	flexDirection: "column" as const,
	alignItems: "center",
};

function Preview() {
	return (
		<div style={{ padding: "32px", fontFamily: "system-ui" }}>
			<h2>Icons</h2>
			<div style={section}>
				<div style={box}>
					<DancerIcon />
					<span style={label}>dancer (static)</span>
				</div>
				<div style={box}>
					<DancerIcon animate />
					<span style={label}>dancer (sway)</span>
				</div>
				<div style={box}>
					<SpeakerIcon />
					<span style={label}>speaker</span>
				</div>
				<div style={box}>
					<RadioTowerIcon />
					<span style={label}>radio tower</span>
				</div>
				<div style={box}>
					<RadioTowerIcon active />
					<span style={label}>radio tower (active)</span>
				</div>
				<div style={box}>
					<PodcastIcon />
					<span style={label}>podcast</span>
				</div>
			</div>

			<h2>Vinyl Spinner</h2>
			<div style={section}>
				<div style={box}>
					<VinylSpinner />
					<span style={label}>static</span>
				</div>
				<div style={box}>
					<VinylSpinner spinning />
					<span style={label}>spinning</span>
				</div>
				<div style={box}>
					<VinylSpinner spinning audioReactive />
					<span style={label}>audio-reactive</span>
				</div>
			</div>

			<h2>Loading Atmosphere</h2>
			<div style={section}>
				<LoadingAtmosphere>
					<div
						style={{
							width: "200px",
							height: "120px",
							background: "rgba(139,90,43,0.06)",
							borderRadius: "8px",
							display: "flex",
							alignItems: "center",
							justifyContent: "center",
							color: "#8a6a4e",
						}}
					>
						loading...
					</div>
				</LoadingAtmosphere>
				<LoadingAtmosphere loaded>
					<div
						style={{
							width: "200px",
							height: "120px",
							background: "rgba(139,90,43,0.06)",
							borderRadius: "8px",
							display: "flex",
							alignItems: "center",
							justifyContent: "center",
							color: "#8a6a4e",
						}}
					>
						loaded (faded)
					</div>
				</LoadingAtmosphere>
			</div>
		</div>
	);
}

import { createRoot } from "react-dom/client";

createRoot(document.getElementById("app")!).render(<Preview />);

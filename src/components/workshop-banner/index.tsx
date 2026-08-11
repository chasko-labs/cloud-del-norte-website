import Flashbar, {
	type FlashbarProps,
} from "@cloudscape-design/components/flashbar";
import { useEffect, useState } from "react";
import { useTranslation } from "../../hooks/useTranslation";
import "./styles.css";

const LS_REGISTERED = "cdn-quantum-registered";
const LS_DISMISSED = "cdn-quantum-banner-dismissed";
const PARAM_KEY = "registered";
const PARAM_VALUE = "quantum-workshop";

export default function WorkshopBanner() {
	const { t } = useTranslation();
	const [visible, setVisible] = useState(false);

	useEffect(() => {
		// Already dismissed — bail early
		if (localStorage.getItem(LS_DISMISSED) === "true") return;

		// Check URL for ?registered=quantum-workshop
		const url = new URL(window.location.href);
		if (url.searchParams.get(PARAM_KEY) === PARAM_VALUE) {
			localStorage.setItem(LS_REGISTERED, "true");
			// Remove param from URL without reload
			url.searchParams.delete(PARAM_KEY);
			window.history.replaceState({}, "", url.toString());
		}

		// Show banner if registered flag is set
		if (localStorage.getItem(LS_REGISTERED) === "true") {
			setVisible(true);
		}
	}, []);

	if (!visible) return null;

	const items: FlashbarProps.MessageDefinition[] = [
		{
			type: "info",
			dismissible: true,
			dismissLabel: t("workshopBanner.dismiss"),
			onDismiss: () => {
				localStorage.setItem(LS_DISMISSED, "true");
				setVisible(false);
			},
			content: (
				<span className="workshop-banner__content">
					{t("workshopBanner.message")}
				</span>
			),
			id: "quantum-workshop-registered",
			action: (
				<span className="workshop-banner__actions">
					<a
						href="https://quantum.clouddelnorte.org/"
						className="workshop-banner__link workshop-banner__link--primary"
					>
						{t("workshopBanner.backToWorkshop")}
					</a>
					<a
						href="https://auth.clouddelnorte.org/signup/index.html"
						className="workshop-banner__link workshop-banner__link--secondary"
					>
						{t("workshopBanner.joinCdn")}
					</a>
				</span>
			),
		},
	];

	return (
		<div className="workshop-banner">
			<Flashbar items={items} />
		</div>
	);
}

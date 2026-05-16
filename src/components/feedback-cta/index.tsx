import Button from "@cloudscape-design/components/button";
import { useState } from "react";
import { useTranslation } from "../../hooks/useTranslation";
import FeedbackForm from "../feedback-form";

interface Props {
	kind: "bug" | "wish";
}

export default function FeedbackCta({ kind }: Props) {
	const { t } = useTranslation();
	const [open, setOpen] = useState(false);

	const name =
		kind === "bug" ? t("helpPanel.reportBugName") : t("helpPanel.makeWishName");
	const desc =
		kind === "bug" ? t("helpPanel.reportBugDesc") : t("helpPanel.makeWishDesc");
	const cta =
		kind === "bug" ? t("helpPanel.reportBugCta") : t("helpPanel.makeWishCta");

	return (
		<>
			<div className="hp-role-card hp-role-card--cta">
				<p className="hp-role-card-name">{name}</p>
				<p className="hp-role-card-desc">{desc}</p>
				<div style={{ marginTop: "8px" }}>
					<Button variant="primary" onClick={() => setOpen(true)}>
						{cta}
					</Button>
				</div>
			</div>
			<FeedbackForm open={open} onClose={() => setOpen(false)} kind={kind} />
		</>
	);
}

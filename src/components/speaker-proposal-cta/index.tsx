import Button from "@cloudscape-design/components/button";
import Container from "@cloudscape-design/components/container";
import Header from "@cloudscape-design/components/header";
import { useState } from "react";
import { useTranslation } from "../../hooks/useTranslation";
import SpeakerProposalForm from "../speaker-proposal-form";
import "./styles.css";

export default function SpeakerProposalCta({
	source = "home",
}: {
	source?: "home" | "awsug-panel" | "feed";
}) {
	const { t } = useTranslation();
	const [open, setOpen] = useState(false);

	return (
		<>
			<div className="cdn-card cdn-card--cta">
				<Container
					header={
						<Header
							variant="h2"
							actions={
								<Button variant="primary" onClick={() => setOpen(true)}>
									{t("homePage.speakerCta.cta")}
								</Button>
							}
						>
							{t("homePage.speakerCta.header")}
						</Header>
					}
				>
					<p>{t("homePage.speakerCta.body")}</p>
				</Container>
			</div>
			<SpeakerProposalForm
				open={open}
				onClose={() => setOpen(false)}
				source={source}
			/>
		</>
	);
}

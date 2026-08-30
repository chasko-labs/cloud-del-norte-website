// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import Box from "@cloudscape-design/components/box";
import Button from "@cloudscape-design/components/button";
import Container from "@cloudscape-design/components/container";
import Header from "@cloudscape-design/components/header";
import SpaceBetween from "@cloudscape-design/components/space-between";
import { useTranslation } from "../../hooks/useTranslation";

// Direct jitsi room for the Aug 30 Quantum Essentials workshop. Bare anchor via
// Button href so the join path is a single quickable click, not buried text.
const JOIN_URL = "https://meet.clouddelnorte.org/braket30";
const REGISTER_URL = "https://quantum.clouddelnorte.org";

// Reuses .cdn-card--cta so the join CTA inherits the prominent purple-gradient
// primary button + attention bounce (bounce is gated behind
// prefers-reduced-motion in the shared stylesheet — accessibility preserved).
export default function JoinWorkshopCta() {
	const { t } = useTranslation();

	return (
		<div className="cdn-card cdn-card--cta">
			<Container
				header={
					<Header
						variant="h2"
						actions={
							<Button
								variant="primary"
								href={JOIN_URL}
								target="_blank"
								iconName="external"
							>
								{t("homePage.joinWorkshopCta.cta")}
							</Button>
						}
					>
						{t("homePage.joinWorkshopCta.header")}
					</Header>
				}
			>
				<SpaceBetween size="s">
					<Box variant="h3">{t("homePage.joinWorkshopCta.title")}</Box>
					<Box color="text-body-secondary">
						{t("homePage.joinWorkshopCta.when")}
					</Box>
					<SpaceBetween direction="horizontal" size="xs">
						<Button href={JOIN_URL} target="_blank" iconName="external">
							{t("homePage.joinWorkshopCta.cta")}
						</Button>
						<Button href={REGISTER_URL} target="_blank">
							{t("homePage.joinWorkshopCta.register")}
						</Button>
					</SpaceBetween>
				</SpaceBetween>
			</Container>
		</div>
	);
}

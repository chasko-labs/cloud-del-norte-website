// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import Container from "@cloudscape-design/components/container";
import FormField from "@cloudscape-design/components/form-field";
import Header from "@cloudscape-design/components/header";
import Multiselect, {
	type MultiselectProps,
} from "@cloudscape-design/components/multiselect";
import RadioGroup from "@cloudscape-design/components/radio-group";
import SpaceBetween from "@cloudscape-design/components/space-between";
import { useState } from "react";
import { useTranslation } from "../../../hooks/useTranslation";
import { meeting_type, services } from "../../meetings/data";
import { BasicValidationContext } from "../validation/basic-validation";

const options = [...services, ...meeting_type].map((i) => ({
	value: i,
	label: i,
}));

export default function details() {
	const { t } = useTranslation();
	const [published, setPublished] = useState("yes");
	const [selecteddetails, setSelecteddetails] = useState<
		MultiselectProps["selectedOptions"]
	>([]);

	return (
		<BasicValidationContext.Consumer>
			{({ isFormSubmitted, addErrorField }) => {
				const detailsErrorText =
					selecteddetails.length === 0 &&
					t("createMeeting.details.listRequired");

				return (
					<Container
						header={
							<Header variant="h2">{t("createMeeting.details.header")}</Header>
						}
					>
						<SpaceBetween direction="vertical" size="l">
							<FormField
								label={t("createMeeting.details.listLabel")}
								errorText={isFormSubmitted && detailsErrorText}
								i18nStrings={{
									errorIconAriaLabel: t(
										"createMeeting.meetingDetails.errorIconAriaLabel",
									),
								}}
							>
								<Multiselect
									placeholder={t("createMeeting.details.selectPlaceholder")}
									selectedOptions={selecteddetails}
									onChange={({ detail }) =>
										setSelecteddetails(detail.selectedOptions)
									}
									options={options}
									deselectAriaLabel={(option) => {
										const label = option?.value || option?.label;
										return label
											? `${t("createMeeting.details.deselectAriaLabel")} ${label}`
											: t("createMeeting.details.noLabel");
									}}
									ref={(ref) =>
										addErrorField("selecteddetails", {
											isValid: !detailsErrorText,
											ref,
										})
									}
								/>
							</FormField>
							<FormField label={t("createMeeting.details.publishedLabel")}>
								<RadioGroup
									value={published}
									onChange={({ detail }) => setPublished(detail.value)}
									items={[
										{ value: "no", label: t("createMeeting.details.no") },
										{ value: "yes", label: t("createMeeting.details.yes") },
									]}
								/>
							</FormField>
						</SpaceBetween>
					</Container>
				);
			}}
		</BasicValidationContext.Consumer>
	);
}

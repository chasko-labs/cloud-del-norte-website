// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
import Select from "@cloudscape-design/components/select";
import { useTranslation } from "../../hooks/useTranslation";
import {
	getStoredTimezone,
	getSupportedZones,
	setStoredTimezone,
} from "../../pages/meetings/util/timezone";

export interface TimezoneSelectProps {
	value: string;
	onChange: (tz: string) => void;
}

const zones = getSupportedZones();
const options = zones.map((tz) => ({ value: tz, label: tz }));

export default function TimezoneSelect({
	value,
	onChange,
}: TimezoneSelectProps) {
	const { t } = useTranslation();
	return (
		<Select
			selectedOption={{ value, label: value }}
			onChange={({ detail }) => {
				const tz = detail.selectedOption.value ?? getStoredTimezone();
				setStoredTimezone(tz);
				onChange(tz);
			}}
			options={options}
			filteringType="auto"
			ariaLabel={t("meetings.timezone.label")}
			placeholder={t("meetings.timezone.label")}
		/>
	);
}

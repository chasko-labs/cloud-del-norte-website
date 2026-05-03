// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import { useTranslation } from "../../../hooks/useTranslation";
import type { BadgeKey } from "./builder-center-data";

interface Props {
	badge: BadgeKey;
}

// Small reusable pill that renders the i18n'd label for one of the three
// AWS Builder Center role badges. Modifier class drives the pill color.
export default function BuilderBadge({ badge }: Props) {
	const { t } = useTranslation();
	const label = t(`feedPage.builderBadge.${badge}`);
	return (
		<span className={`feed-builder-badge feed-builder-badge--${badge}`}>
			{label}
		</span>
	);
}

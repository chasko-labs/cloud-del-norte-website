// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import BreadcrumbGroup, {
	type BreadcrumbGroupProps,
} from "@cloudscape-design/components/breadcrumb-group";
import React from "react";
import { useTranslation } from "../../hooks/useTranslation";

export interface BreadcrumbsProps {
	active: BreadcrumbGroupProps.Item;
}

export default function Breadcrumbs({ active }: BreadcrumbsProps) {
	const { t } = useTranslation();
	const items: BreadcrumbGroupProps.Item[] = [
		{ text: t("breadcrumbs.home"), href: "/home/index.html" },
	];
	return <BreadcrumbGroup items={[...items, active]} />;
}

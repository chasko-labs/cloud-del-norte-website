// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

export interface ColorToken {
	name: string;
	variable: string;
	hex: string;
	description: string;
}

export interface TypographyToken {
	name: string;
	variable: string;
	size: string;
	usage: string;
}

export interface ShadowToken {
	name: string;
	variable: string;
	usage: string;
}

export interface ElevationToken {
	level: string;
	variable: string;
	hex: string;
	usage: string;
}

export const brandColors: ColorToken[] = [
	{
		name: "themePage.colors.navy.name",
		variable: "--cdn-navy",
		hex: "#00002a",
		description: "themePage.colors.navy.description",
	},
	{
		name: "themePage.colors.amber.name",
		variable: "--cdn-amber",
		hex: "#8b5a2b",
		description: "themePage.colors.amber.description",
	},
	{
		name: "themePage.colors.purple.name",
		variable: "--cdn-purple",
		hex: "#5a1f8a",
		description: "themePage.colors.purple.description",
	},
	{
		name: "themePage.colors.violet.name",
		variable: "--cdn-violet",
		hex: "#9060f0",
		description: "themePage.colors.violet.description",
	},
	{
		name: "themePage.colors.lavender.name",
		variable: "--cdn-lavender",
		hex: "#d7c7ee",
		description: "themePage.colors.lavender.description",
	},
	{
		name: "themePage.colors.awsOrange.name",
		variable: "--cdn-aws-orange",
		hex: "#FF9900",
		description: "themePage.colors.awsOrange.description",
	},
	{
		name: "themePage.colors.gold.name",
		variable: "--cdn-gold",
		hex: "#c9a23f",
		description: "themePage.colors.gold.description",
	},
];

export const textEmphasisLevels: ColorToken[] = [
	{
		name: "themePage.emphasis.high.name",
		variable: "--cdn-color-text-high",
		hex: "#1a0f05 / rgba(240,240,240,0.87)",
		description: "themePage.emphasis.high.description",
	},
	{
		name: "themePage.emphasis.medium.name",
		variable: "--cdn-color-text-medium",
		hex: "#5a3a1e / rgba(240,240,240,0.60)",
		description: "themePage.emphasis.medium.description",
	},
	{
		name: "themePage.emphasis.low.name",
		variable: "--cdn-color-text-low",
		hex: "#8a6a4e / rgba(240,240,240,0.38)",
		description: "themePage.emphasis.low.description",
	},
];

export const elevationLevels: ElevationToken[] = [
	{
		level: "0",
		variable: "--cdn-elevation-0",
		hex: "#0a0a2e",
		usage: "themePage.elevation.level0",
	},
	{
		level: "1",
		variable: "--cdn-elevation-1",
		hex: "#12123a",
		usage: "themePage.elevation.level1",
	},
	{
		level: "2",
		variable: "--cdn-elevation-2",
		hex: "#1a1a4a",
		usage: "themePage.elevation.level2",
	},
	{
		level: "3",
		variable: "--cdn-elevation-3",
		hex: "#22225a",
		usage: "themePage.elevation.level3",
	},
];

export const shadowTokens: ShadowToken[] = [
	{
		name: "themePage.shadows.small.name",
		variable: "--cdn-shadow-sm",
		usage: "themePage.shadows.small.usage",
	},
	{
		name: "themePage.shadows.medium.name",
		variable: "--cdn-shadow-md",
		usage: "themePage.shadows.medium.usage",
	},
	{
		name: "themePage.shadows.glow.name",
		variable: "--cdn-shadow-glow",
		usage: "themePage.shadows.glow.usage",
	},
];

export const typographyScale: TypographyToken[] = [
	{
		name: "themePage.typography.small.name",
		variable: "--cdn-text-sm",
		size: "0.75rem (12px)",
		usage: "themePage.typography.small.usage",
	},
	{
		name: "themePage.typography.base.name",
		variable: "--cdn-text-base",
		size: "0.875rem (14px)",
		usage: "themePage.typography.base.usage",
	},
	{
		name: "themePage.typography.large.name",
		variable: "--cdn-text-lg",
		size: "1rem (16px)",
		usage: "themePage.typography.large.usage",
	},
	{
		name: "themePage.typography.extraLarge.name",
		variable: "--cdn-text-xl",
		size: "1.25rem (20px)",
		usage: "themePage.typography.extraLarge.usage",
	},
	{
		name: "themePage.typography.twoExtraLarge.name",
		variable: "--cdn-text-2xl",
		size: "1.5rem (24px)",
		usage: "themePage.typography.twoExtraLarge.usage",
	},
];

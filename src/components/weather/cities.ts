// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

/**
 * Norte weather carousel — destinations the AWS user group community
 * collectively spans. Bryan v0.0.0073: rotate through these via tap / swipe.
 *
 * Coordinates kept local to the module so we don't need a network call to
 * resolve them. Open-Meteo's free /v1/forecast accepts arbitrary lat/lon.
 */

export interface City {
	readonly key: string;
	readonly label: string;
	readonly latitude: number;
	readonly longitude: number;
	/** IANA timezone — keeps the daily-array buckets aligned to local day */
	readonly timezone: string;
}

export const CITIES: City[] = [
	{
		key: "el_paso",
		label: "el paso",
		latitude: 31.7619,
		longitude: -106.485,
		timezone: "America/Denver",
	},
	{
		key: "mescalero",
		label: "mescalero",
		latitude: 33.1532,
		longitude: -105.7825,
		timezone: "America/Denver",
	},
	{
		key: "santa_fe",
		label: "santa fe",
		latitude: 35.687,
		longitude: -105.9378,
		timezone: "America/Denver",
	},
	{
		key: "south_padre",
		label: "south padre",
		latitude: 26.1118,
		longitude: -97.1681,
		timezone: "America/Chicago",
	},
	{
		key: "creel",
		label: "creel",
		latitude: 27.7515,
		longitude: -107.6321,
		timezone: "America/Chihuahua",
	},
	{
		key: "paquime",
		// Paquimé archaeological zone, Casas Grandes, Chihuahua. Open-Meteo
		// resolves to the Casas Grandes municipal grid cell — bryan: "if
		// weather from paquime isn't available use casas grandes". Same cell.
		label: "paquimé",
		latitude: 30.37,
		longitude: -107.95,
		timezone: "America/Chihuahua",
	},
];

// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

export interface PersistedPlayerState {
	stationKey: string;
	stationUrl: string;
	stationLabel: string;
	metaUrl: string;
}

const KEY = "cdn:player:v1";

export function savePlayerState(state: PersistedPlayerState): void {
	try {
		sessionStorage.setItem(KEY, JSON.stringify(state));
	} catch {
		// sessionStorage unavailable — non-fatal
	}
}

export function clearPlayerState(): void {
	try {
		sessionStorage.removeItem(KEY);
	} catch {
		// non-fatal
	}
}

export function loadPlayerState(): PersistedPlayerState | null {
	try {
		const raw = sessionStorage.getItem(KEY);
		if (!raw) return null;
		return JSON.parse(raw) as PersistedPlayerState;
	} catch {
		return null;
	}
}

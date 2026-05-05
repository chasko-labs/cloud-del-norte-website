// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

export interface PersistedPlayerState {
	stationKey: string;
	stationUrl: string;
	stationLabel: string;
	/** absent for stations with no now-playing endpoint */
	metaUrl?: string;
}

const KEY = "cdn:player:v1";
const PODCAST_RESUME_KEY = "cdn:podcast-resume:v1";

export interface PodcastResumeState {
	stationKey: string;
	episodeUrl: string;
	currentTime: number;
}

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

export function savePodcastResume(state: PodcastResumeState): void {
	try {
		localStorage.setItem(PODCAST_RESUME_KEY, JSON.stringify(state));
	} catch {
		// non-fatal
	}
}

export function loadPodcastResume(): PodcastResumeState | null {
	try {
		const raw = localStorage.getItem(PODCAST_RESUME_KEY);
		if (!raw) return null;
		return JSON.parse(raw) as PodcastResumeState;
	} catch {
		return null;
	}
}

export function clearPodcastResume(): void {
	try {
		localStorage.removeItem(PODCAST_RESUME_KEY);
	} catch {
		// non-fatal
	}
}

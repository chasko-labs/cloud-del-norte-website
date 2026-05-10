// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

export interface PersistedPlayerState {
	stationKey: string;
	stationUrl: string;
	stationLabel: string;
	/** absent for stations with no now-playing endpoint */
	metaUrl?: string;
	/** last known playback position for podcast episodes (seconds) */
	podcastCurrentTime?: number;
	/** enclosure URL of the episode whose position is saved */
	podcastEpisodeUrl?: string;
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
		localStorage.setItem(KEY, JSON.stringify(state));
	} catch {
		// localStorage unavailable — non-fatal
	}
}

export function clearPlayerState(): void {
	try {
		localStorage.removeItem(KEY);
	} catch {
		// non-fatal
	}
}

/** Clears only the podcast resume fields, preserving station selection. */
export function clearPodcastPosition(): void {
	try {
		const raw = localStorage.getItem(KEY);
		if (!raw) return;
		const state = JSON.parse(raw) as PersistedPlayerState;
		delete state.podcastCurrentTime;
		delete state.podcastEpisodeUrl;
		localStorage.setItem(KEY, JSON.stringify(state));
	} catch {
		// non-fatal
	}
}

export function loadPlayerState(): PersistedPlayerState | null {
	try {
		const raw = localStorage.getItem(KEY);
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

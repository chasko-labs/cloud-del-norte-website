import type { Confidence, ProjectedEntry, ReleaseEntry } from "../types";

const N_ANY = 5; // history window for "any release" projections
const N_LTS = 3; // history window for LTS projections

/**
 * Calculate average interval in days between consecutive releases.
 * Returns null if fewer than 2 releases provided.
 */
export function avgIntervalDays(releases: ReleaseEntry[]): number | null {
	if (releases.length < 2) return null;
	const sorted = [...releases].sort(
		(a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
	);
	const gaps: number[] = [];
	for (let i = 1; i < sorted.length; i++) {
		gaps.push(
			(new Date(sorted[i].date).getTime() -
				new Date(sorted[i - 1].date).getTime()) /
				86400000,
		);
	}
	return gaps.reduce((sum, g) => sum + g, 0) / gaps.length;
}

/**
 * Determine confidence tier based on sample size N.
 * highThreshold defaults to N_ANY (5); pass N_LTS (3) for LTS projections.
 */
export function confidenceFromN(
	n: number,
	highThreshold: number = N_ANY,
): Confidence {
	if (n >= highThreshold) return "high";
	if (n >= 2) return "medium";
	if (n === 1) return "low";
	return "insufficient";
}

/**
 * Project next release date for "any release" type.
 * If announcedDate is set on the most recent release record, use it directly.
 */
export function projectNextVersion(
	releases: ReleaseEntry[],
	announcedDate?: string,
): ProjectedEntry | null {
	if (!releases.length) return null;

	if (announcedDate) {
		return {
			projectedDate: announcedDate,
			confidence: "announced",
			basedOn: "Officially announced release date",
			announcedDate,
		};
	}

	const window = releases.slice(-N_ANY);
	const avgDays = avgIntervalDays(window);
	if (!avgDays) return null;

	const mostRecent = releases.reduce((a, b) =>
		new Date(a.date) > new Date(b.date) ? a : b,
	);
	const projected = new Date(
		new Date(mostRecent.date).getTime() + avgDays * 86400000,
	);
	const confidence = confidenceFromN(window.length);
	if (confidence === "insufficient") return null;

	return {
		projectedDate: projected.toISOString().split("T")[0],
		confidence,
		basedOn: `Average of last ${window.length} release intervals (${Math.round(avgDays)} days)`,
	};
}

/**
 * Project next LTS release date.
 */
export function projectNextLTS(
	ltsReleases: ReleaseEntry[],
	announcedDate?: string,
): ProjectedEntry | null {
	if (!ltsReleases.length) return null;

	if (announcedDate) {
		return {
			projectedDate: announcedDate,
			confidence: "announced",
			basedOn: "Officially announced LTS release date",
			announcedDate,
		};
	}

	const window = ltsReleases.slice(-N_LTS);
	const avgDays = avgIntervalDays(window);
	if (!avgDays) return null;

	const mostRecent = ltsReleases.reduce((a, b) =>
		new Date(a.date) > new Date(b.date) ? a : b,
	);
	const projected = new Date(
		new Date(mostRecent.date).getTime() + avgDays * 86400000,
	);
	const confidence = confidenceFromN(window.length, N_LTS);
	if (confidence === "insufficient") return null;

	return {
		projectedDate: projected.toISOString().split("T")[0],
		confidence,
		basedOn: `Average of last ${window.length} LTS release intervals (${Math.round(avgDays)} days)`,
	};
}

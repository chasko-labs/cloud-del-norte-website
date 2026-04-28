export type DataSource = "api" | "rss" | "manual";
export type Confidence =
	| "announced"
	| "high"
	| "medium"
	| "low"
	| "insufficient";
export type Category =
	| "Language"
	| "AI Model"
	| "AWS Service"
	| "Tool"
	| "Standard"
	| "Framework";

export interface ReleaseEntry {
	version: string;
	date: string; // ISO 8601 YYYY-MM-DD
	releaseNotesUrl: string;
	isLTS: boolean;
}

export interface ProjectedEntry {
	projectedDate: string; // ISO 8601 YYYY-MM-DD
	confidence: Confidence;
	basedOn: string; // human-readable explanation
	announcedDate?: string; // if officially announced, overrides formula
	sourceUrl?: string;
}

export interface TechCalendar {
	id: string; // URL-safe slug, e.g. "python", "aws-lambda"
	name: string; // Display name
	category: Category;
	dataSource: DataSource;
	sourceUrl: string; // canonical release page
	lastManualUpdate?: string; // ISO date, required for manual entries
	mostRecentLTS: ReleaseEntry | null;
	mostRecentAny: ReleaseEntry | null;
	projectedNextVersion: ProjectedEntry | null;
	projectedNextLTS: ProjectedEntry | null;
	priorLTS: ReleaseEntry | null;
	secondPriorLTS: ReleaseEntry | null;
}

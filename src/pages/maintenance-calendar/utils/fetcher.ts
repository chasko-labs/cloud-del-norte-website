import type { TechCalendar, ReleaseEntry } from '../types';

export interface ManualEntry extends Partial<TechCalendar> {
  id: string;
  lastManualUpdate?: string;
}

/**
 * Merge fetched partials over a seed baseline.
 * Later entries in `partials` override earlier ones; all override seed.
 */
export function mergePartials(
  seed: TechCalendar[],
  partials: Array<Partial<TechCalendar> & { id: string }>
): TechCalendar[] {
  const result = new Map(seed.map(t => [t.id, { ...t }]));
  for (const partial of partials) {
    if (result.has(partial.id)) {
      result.set(partial.id, { ...result.get(partial.id)!, ...partial });
    }
  }
  return Array.from(result.values());
}

/**
 * Apply manual overrides. Manual always wins on any field it provides.
 * Returns a new array; does not mutate input.
 */
export function applyManualOverrides(
  techs: TechCalendar[],
  manualEntries: ManualEntry[]
): TechCalendar[] {
  const result = new Map(techs.map(t => [t.id, { ...t }]));
  for (const manual of manualEntries) {
    if (result.has(manual.id)) {
      result.set(manual.id, { ...result.get(manual.id)!, ...manual });
    }
  }
  return Array.from(result.values());
}

/**
 * Check if a manual entry is stale (older than thresholdDays).
 * Returns the age in days if stale, or null if fresh or no lastManualUpdate.
 */
export function checkStaleManual(
  entry: ManualEntry,
  thresholdDays = 90,
  now = new Date()
): number | null {
  if (!entry.lastManualUpdate) return null;
  const ageDays = (now.getTime() - new Date(entry.lastManualUpdate).getTime()) / 86400000;
  return ageDays > thresholdDays ? Math.round(ageDays) : null;
}

/**
 * Normalize a GitHub API release object to a ReleaseEntry.
 */
export function normalizeGitHubRelease(
  rel: { tag_name: string; published_at?: string; created_at?: string; html_url: string; prerelease: boolean; draft: boolean },
  isLTS = false
): ReleaseEntry {
  return {
    version: rel.tag_name,
    date: (rel.published_at ?? rel.created_at ?? '').split('T')[0],
    releaseNotesUrl: rel.html_url,
    isLTS,
  };
}

/**
 * Filter GitHub releases to stable only (not prerelease, not draft).
 */
export function filterStableReleases<T extends { prerelease: boolean; draft: boolean }>(
  releases: T[]
): T[] {
  return releases.filter(r => !r.prerelease && !r.draft);
}

import { describe, it, expect } from 'vitest';
import type { ReleaseEntry } from '../../types';
import {
  avgIntervalDays,
  confidenceFromN,
  projectNextVersion,
  projectNextLTS,
} from '../projection';

function makeRelease(date: string, version: string = '1.0'): ReleaseEntry {
  return { version, date, releaseNotesUrl: '', isLTS: false };
}

// Fixed test fixtures — deterministic dates
const REL_2024_01 = makeRelease('2024-01-01', '1.0');
const REL_2024_04 = makeRelease('2024-04-01', '2.0'); // ~90 days later
const REL_2024_07 = makeRelease('2024-07-01', '3.0'); // ~91 days later
const REL_2024_10 = makeRelease('2024-10-01', '4.0'); // ~92 days later
const REL_2025_01 = makeRelease('2025-01-01', '5.0'); // ~92 days later

describe('avgIntervalDays', () => {
  it('returns null for 0 releases', () => {
    expect(avgIntervalDays([])).toBeNull();
  });

  it('returns null for 1 release', () => {
    expect(avgIntervalDays([REL_2024_01])).toBeNull();
  });

  it('calculates correct average for 2 releases (365 days apart)', () => {
    const a = makeRelease('2024-01-01');
    const b = makeRelease('2025-01-01');
    const avg = avgIntervalDays([a, b]);
    expect(avg).not.toBeNull();
    expect(Math.round(avg!)).toBe(366); // 2024 is a leap year
  });

  it('handles unsorted input and still computes correct average', () => {
    const unsorted = [REL_2024_10, REL_2024_01, REL_2024_07, REL_2024_04];
    const sorted = [REL_2024_01, REL_2024_04, REL_2024_07, REL_2024_10];
    expect(avgIntervalDays(unsorted)).toBeCloseTo(avgIntervalDays(sorted)!, 5);
  });

  it('calculates correct average across 5 evenly-spaced releases', () => {
    // Each ~91 days apart; average should be close to 91
    const releases = [REL_2024_01, REL_2024_04, REL_2024_07, REL_2024_10, REL_2025_01];
    const avg = avgIntervalDays(releases);
    expect(avg).not.toBeNull();
    expect(avg!).toBeGreaterThan(85);
    expect(avg!).toBeLessThan(100);
  });
});

describe('confidenceFromN', () => {
  it('returns "insufficient" for N=0', () => {
    expect(confidenceFromN(0)).toBe('insufficient');
  });

  it('returns "low" for N=1', () => {
    expect(confidenceFromN(1)).toBe('low');
  });

  it('returns "medium" for N=2', () => {
    expect(confidenceFromN(2)).toBe('medium');
  });

  it('returns "medium" for N=4', () => {
    expect(confidenceFromN(4)).toBe('medium');
  });

  it('returns "high" for N=5', () => {
    expect(confidenceFromN(5)).toBe('high');
  });

  it('returns "high" for N>5', () => {
    expect(confidenceFromN(10)).toBe('high');
  });
});

describe('projectNextVersion', () => {
  it('returns null for empty releases array', () => {
    expect(projectNextVersion([])).toBeNull();
  });

  it('returns null for N=1 (insufficient)', () => {
    expect(projectNextVersion([REL_2024_01])).toBeNull();
  });

  it('returns confidence "medium" for N=2', () => {
    const result = projectNextVersion([REL_2024_01, REL_2024_04]);
    expect(result).not.toBeNull();
    expect(result!.confidence).toBe('medium');
  });

  it('returns confidence "high" for N≥5 releases', () => {
    const releases = [REL_2024_01, REL_2024_04, REL_2024_07, REL_2024_10, REL_2025_01];
    const result = projectNextVersion(releases);
    expect(result).not.toBeNull();
    expect(result!.confidence).toBe('high');
  });

  it('projects a date after the most recent release', () => {
    const releases = [REL_2024_01, REL_2024_04, REL_2024_07, REL_2024_10, REL_2025_01];
    const result = projectNextVersion(releases);
    expect(result).not.toBeNull();
    expect(result!.projectedDate > '2025-01-01').toBe(true);
  });

  it('returns announced date with confidence "announced" when announcedDate is provided', () => {
    const releases = [REL_2024_01, REL_2024_04];
    const result = projectNextVersion(releases, '2025-06-15');
    expect(result).not.toBeNull();
    expect(result!.confidence).toBe('announced');
    expect(result!.projectedDate).toBe('2025-06-15');
    expect(result!.announcedDate).toBe('2025-06-15');
  });

  it('announcedDate overrides formula even with insufficient history', () => {
    const result = projectNextVersion([REL_2024_01], '2025-03-01');
    expect(result).not.toBeNull();
    expect(result!.confidence).toBe('announced');
    expect(result!.projectedDate).toBe('2025-03-01');
  });
});

describe('projectNextLTS', () => {
  it('returns null for empty releases array', () => {
    expect(projectNextLTS([])).toBeNull();
  });

  it('returns null for N=1 (insufficient)', () => {
    expect(projectNextLTS([REL_2024_01])).toBeNull();
  });

  it('uses N=3 window — returns "high" confidence with only 3 releases', () => {
    const releases = [REL_2024_01, REL_2024_07, REL_2025_01];
    const result = projectNextLTS(releases);
    expect(result).not.toBeNull();
    expect(result!.confidence).toBe('high');
  });

  it('would only be "medium" for projectNextVersion with same 3 releases (N=5 window)', () => {
    const releases = [REL_2024_01, REL_2024_07, REL_2025_01];
    const result = projectNextVersion(releases);
    expect(result).not.toBeNull();
    expect(result!.confidence).toBe('medium');
  });

  it('returns announced date with confidence "announced" when announcedDate is provided', () => {
    const releases = [REL_2024_01, REL_2024_07];
    const result = projectNextLTS(releases, '2025-07-01');
    expect(result).not.toBeNull();
    expect(result!.confidence).toBe('announced');
    expect(result!.projectedDate).toBe('2025-07-01');
    expect(result!.announcedDate).toBe('2025-07-01');
  });

  it('projects a date after the most recent LTS release', () => {
    const releases = [REL_2024_01, REL_2024_07, REL_2025_01];
    const result = projectNextLTS(releases);
    expect(result).not.toBeNull();
    expect(result!.projectedDate > '2025-01-01').toBe(true);
  });
});

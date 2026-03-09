import { describe, it, expect } from 'vitest';
import {
  mergePartials,
  applyManualOverrides,
  checkStaleManual,
  normalizeGitHubRelease,
  filterStableReleases,
} from '../fetcher';
import type { TechCalendar } from '../../types';

const baseTech: TechCalendar = {
  id: 'python',
  name: 'Python',
  category: 'Language',
  dataSource: 'api',
  sourceUrl: 'https://example.com/python',
  mostRecentLTS: null,
  mostRecentAny: null,
  projectedNextVersion: null,
  projectedNextLTS: null,
  priorLTS: null,
  secondPriorLTS: null,
};

const nodeTech: TechCalendar = {
  ...baseTech,
  id: 'node',
  name: 'Node.js',
};

describe('mergePartials', () => {
  it('partial overrides matching seed field', () => {
    const result = mergePartials([baseTech], [{ id: 'python', name: 'Python 3' }]);
    expect(result.find(t => t.id === 'python')?.name).toBe('Python 3');
  });

  it('unknown id in partial is ignored (not added to result)', () => {
    const result = mergePartials([baseTech], [{ id: 'ruby', name: 'Ruby' }]);
    expect(result).toHaveLength(1);
    expect(result.find(t => t.id === 'ruby')).toBeUndefined();
  });

  it('seed entry with no matching partial is preserved unchanged', () => {
    const result = mergePartials([baseTech, nodeTech], [{ id: 'python', name: 'Python 3' }]);
    expect(result.find(t => t.id === 'node')?.name).toBe('Node.js');
  });

  it('multiple partials applied in order (last wins)', () => {
    const result = mergePartials(
      [baseTech],
      [
        { id: 'python', name: 'Python First' },
        { id: 'python', name: 'Python Last' },
      ]
    );
    expect(result.find(t => t.id === 'python')?.name).toBe('Python Last');
  });
});

describe('applyManualOverrides', () => {
  it('manual entry overrides fetched field', () => {
    const fetched: TechCalendar[] = [{ ...baseTech, name: 'Python Fetched' }];
    const result = applyManualOverrides(fetched, [{ id: 'python', name: 'Python Manual' }]);
    expect(result.find(t => t.id === 'python')?.name).toBe('Python Manual');
  });

  it('manual entry for unknown id is ignored', () => {
    const result = applyManualOverrides([baseTech], [{ id: 'ruby', name: 'Ruby' }]);
    expect(result).toHaveLength(1);
    expect(result.find(t => t.id === 'ruby')).toBeUndefined();
  });

  it('multiple manual entries applied correctly', () => {
    const fetched = [baseTech, nodeTech];
    const result = applyManualOverrides(fetched, [
      { id: 'python', name: 'Python Manual' },
      { id: 'node', name: 'Node Manual' },
    ]);
    expect(result.find(t => t.id === 'python')?.name).toBe('Python Manual');
    expect(result.find(t => t.id === 'node')?.name).toBe('Node Manual');
  });

  it('manual always beats a fetched partial regardless of application order', () => {
    // Apply fetch partial first, then manual — manual should win
    const afterFetch = mergePartials([baseTech], [{ id: 'python', name: 'Python Fetched' }]);
    const afterManual = applyManualOverrides(afterFetch, [{ id: 'python', name: 'Python Manual' }]);
    expect(afterManual.find(t => t.id === 'python')?.name).toBe('Python Manual');

    // Apply manual first, then fetch partial — manual should still win (re-apply manual)
    const withFetchOnly = mergePartials([baseTech], [{ id: 'python', name: 'Python Fetched' }]);
    const reapplied = applyManualOverrides(withFetchOnly, [{ id: 'python', name: 'Python Manual' }]);
    expect(reapplied.find(t => t.id === 'python')?.name).toBe('Python Manual');
  });
});

describe('checkStaleManual', () => {
  const fixedNow = new Date('2024-06-01T00:00:00Z');

  it('returns ~91 days when lastManualUpdate is 91 days ago', () => {
    const entry = { id: 'python', lastManualUpdate: '2024-03-02' };
    const result = checkStaleManual(entry, 90, fixedNow);
    expect(result).not.toBeNull();
    expect(result!).toBeGreaterThanOrEqual(90);
  });

  it('returns null when lastManualUpdate is 30 days ago (not stale)', () => {
    const entry = { id: 'python', lastManualUpdate: '2024-05-02' };
    const result = checkStaleManual(entry, 90, fixedNow);
    expect(result).toBeNull();
  });

  it('returns null when no lastManualUpdate', () => {
    const result = checkStaleManual({ id: 'python' }, 90, fixedNow);
    expect(result).toBeNull();
  });

  it('respects custom threshold', () => {
    const entry = { id: 'python', lastManualUpdate: '2024-05-20' }; // 12 days ago
    expect(checkStaleManual(entry, 10, fixedNow)).not.toBeNull();
    expect(checkStaleManual(entry, 30, fixedNow)).toBeNull();
  });

  it('uses the now param for deterministic testing', () => {
    const entry = { id: 'python', lastManualUpdate: '2023-01-01' };
    const result = checkStaleManual(entry, 90, new Date('2023-04-15T00:00:00Z'));
    expect(result).not.toBeNull();
    expect(result!).toBeGreaterThan(90);
  });
});

describe('normalizeGitHubRelease', () => {
  const base = {
    tag_name: 'v3.12.0',
    published_at: '2023-10-02T12:00:00Z',
    created_at: '2023-10-01T08:00:00Z',
    html_url: 'https://github.com/python/cpython/releases/tag/v3.12.0',
    prerelease: false,
    draft: false,
  };

  it('maps tag_name to version', () => {
    expect(normalizeGitHubRelease(base).version).toBe('v3.12.0');
  });

  it('uses published_at when available', () => {
    expect(normalizeGitHubRelease(base).date).toBe('2023-10-02');
  });

  it('falls back to created_at when published_at is missing', () => {
    const { published_at: _, ...withoutPublished } = base;
    expect(normalizeGitHubRelease(withoutPublished).date).toBe('2023-10-01');
  });

  it('strips time portion, keeping only YYYY-MM-DD', () => {
    const date = normalizeGitHubRelease(base).date;
    expect(date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(date).not.toContain('T');
  });

  it('passes isLTS flag through', () => {
    expect(normalizeGitHubRelease(base, true).isLTS).toBe(true);
    expect(normalizeGitHubRelease(base, false).isLTS).toBe(false);
    expect(normalizeGitHubRelease(base).isLTS).toBe(false);
  });
});

describe('filterStableReleases', () => {
  const releases = [
    { tag_name: 'v1.0.0', prerelease: false, draft: false },
    { tag_name: 'v1.1.0-beta', prerelease: true, draft: false },
    { tag_name: 'v1.2.0-draft', prerelease: false, draft: true },
    { tag_name: 'v2.0.0', prerelease: false, draft: false },
  ];

  it('filters out prerelease entries', () => {
    const result = filterStableReleases(releases);
    expect(result.find(r => r.tag_name === 'v1.1.0-beta')).toBeUndefined();
  });

  it('filters out draft entries', () => {
    const result = filterStableReleases(releases);
    expect(result.find(r => r.tag_name === 'v1.2.0-draft')).toBeUndefined();
  });

  it('keeps stable entries', () => {
    const result = filterStableReleases(releases);
    expect(result).toHaveLength(2);
    expect(result.map(r => r.tag_name)).toEqual(['v1.0.0', 'v2.0.0']);
  });
});

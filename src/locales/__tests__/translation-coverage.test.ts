import { describe, it, expect } from 'vitest';
import enUS from '../en-US.json';
import esMX from '../es-MX.json';

function collectKeys(obj: Record<string, unknown>, prefix = ''): string[] {
  const keys: string[] = [];
  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      keys.push(...collectKeys(value as Record<string, unknown>, fullKey));
    } else {
      keys.push(fullKey);
    }
  }
  return keys.sort();
}

describe('translation coverage', () => {
  const enKeys = collectKeys(enUS as Record<string, unknown>);
  const mxKeys = collectKeys(esMX as Record<string, unknown>);

  it('en-US and es-MX have identical key structures', () => {
    expect(enKeys).toEqual(mxKeys);
  });

  it('en-US has no missing keys compared to es-MX', () => {
    const missingInEn = mxKeys.filter(k => !enKeys.includes(k));
    expect(missingInEn).toEqual([]);
  });

  it('es-MX has no missing keys compared to en-US', () => {
    const missingInMx = enKeys.filter(k => !mxKeys.includes(k));
    expect(missingInMx).toEqual([]);
  });

  it('no empty string values in en-US', () => {
    for (const key of enKeys) {
      const value = key.split('.').reduce((obj: Record<string, unknown>, k: string) => {
        if (obj && typeof obj === 'object') return (obj as Record<string, unknown>)[k] as Record<string, unknown>;
        return undefined as unknown as Record<string, unknown>;
      }, enUS as unknown as Record<string, unknown>);
      expect(value, `en-US key "${key}" should not be empty`).not.toBe('');
    }
  });

  it('no empty string values in es-MX', () => {
    for (const key of mxKeys) {
      const value = key.split('.').reduce((obj: Record<string, unknown>, k: string) => {
        if (obj && typeof obj === 'object') return (obj as Record<string, unknown>)[k] as Record<string, unknown>;
        return undefined as unknown as Record<string, unknown>;
      }, esMX as unknown as Record<string, unknown>);
      expect(value, `es-MX key "${key}" should not be empty`).not.toBe('');
    }
  });

  it('both files have at least 3 top-level sections', () => {
    expect(Object.keys(enUS).length).toBeGreaterThanOrEqual(3);
    expect(Object.keys(esMX).length).toBeGreaterThanOrEqual(3);
  });
});

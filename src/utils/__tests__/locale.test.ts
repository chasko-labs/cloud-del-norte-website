import { describe, it, expect, beforeEach } from 'vitest';

// These tests define the contract for src/utils/locale.ts
// They will pass once the locale utility is implemented (PR #4)

describe('locale utility', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.lang = '';
    document.documentElement.removeAttribute('data-locale');
    // Clear module cache so each test gets fresh imports
    vi.resetModules();
  });

  describe('getStoredLocale', () => {
    it('returns "us" when localStorage is empty', async () => {
      const { getStoredLocale } = await import('../locale');
      expect(getStoredLocale()).toBe('us');
    });

    it('returns "us" when stored value is "us"', async () => {
      localStorage.setItem('cdn-locale', 'us');
      const { getStoredLocale } = await import('../locale');
      expect(getStoredLocale()).toBe('us');
    });

    it('returns "mx" when stored value is "mx"', async () => {
      localStorage.setItem('cdn-locale', 'mx');
      const { getStoredLocale } = await import('../locale');
      expect(getStoredLocale()).toBe('mx');
    });

    it('returns "us" for invalid stored value', async () => {
      localStorage.setItem('cdn-locale', 'fr');
      const { getStoredLocale } = await import('../locale');
      expect(getStoredLocale()).toBe('us');
    });

    it('returns "us" for empty string stored value', async () => {
      localStorage.setItem('cdn-locale', '');
      const { getStoredLocale } = await import('../locale');
      expect(getStoredLocale()).toBe('us');
    });
  });

  describe('setStoredLocale', () => {
    it('persists "mx" to localStorage', async () => {
      const { setStoredLocale } = await import('../locale');
      setStoredLocale('mx');
      expect(localStorage.getItem('cdn-locale')).toBe('mx');
    });

    it('persists "us" to localStorage', async () => {
      const { setStoredLocale } = await import('../locale');
      setStoredLocale('us');
      expect(localStorage.getItem('cdn-locale')).toBe('us');
    });

    it('overwrites previous value', async () => {
      const { setStoredLocale } = await import('../locale');
      setStoredLocale('mx');
      setStoredLocale('us');
      expect(localStorage.getItem('cdn-locale')).toBe('us');
    });
  });

  describe('applyLocale', () => {
    it('sets document lang to "en-US" for us locale', async () => {
      const { applyLocale } = await import('../locale');
      applyLocale('us');
      expect(document.documentElement.lang).toBe('en-US');
    });

    it('sets document lang to "es-MX" for mx locale', async () => {
      const { applyLocale } = await import('../locale');
      applyLocale('mx');
      expect(document.documentElement.lang).toBe('es-MX');
    });

    it('sets data-locale attribute to "us"', async () => {
      const { applyLocale } = await import('../locale');
      applyLocale('us');
      expect(document.documentElement.getAttribute('data-locale')).toBe('us');
    });

    it('sets data-locale attribute to "mx"', async () => {
      const { applyLocale } = await import('../locale');
      applyLocale('mx');
      expect(document.documentElement.getAttribute('data-locale')).toBe('mx');
    });
  });

  describe('initializeLocale', () => {
    it('returns stored locale and applies it', async () => {
      localStorage.setItem('cdn-locale', 'mx');
      const { initializeLocale } = await import('../locale');
      const result = initializeLocale();
      expect(result).toBe('mx');
      expect(document.documentElement.lang).toBe('es-MX');
      expect(document.documentElement.getAttribute('data-locale')).toBe('mx');
    });

    it('defaults to "us" when nothing stored', async () => {
      const { initializeLocale } = await import('../locale');
      const result = initializeLocale();
      expect(result).toBe('us');
      expect(document.documentElement.lang).toBe('en-US');
      expect(document.documentElement.getAttribute('data-locale')).toBe('us');
    });
  });

  describe('Locale type', () => {
    it('exports Locale type (compile-time check)', async () => {
      const mod = await import('../locale');
      // Type check: these should be valid Locale values
      const us: typeof mod.getStoredLocale extends () => infer R ? R : never = 'us';
      const mx: typeof mod.getStoredLocale extends () => infer R ? R : never = 'mx';
      expect(us).toBe('us');
      expect(mx).toBe('mx');
    });
  });
});

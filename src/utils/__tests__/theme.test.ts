import { describe, it, expect, beforeEach, vi } from 'vitest';
// MediaQueryListEvent is a DOM global — no import needed.

describe('theme utility', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.resetModules();
  });

  describe('getStoredTheme', () => {
    it('returns system preference when no localStorage', async () => {
      // Mock matchMedia to return dark preference
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: vi.fn().mockImplementation((query: string) => ({
          matches: query === '(prefers-color-scheme: dark)',
          media: query,
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
        })),
      });

      const { getStoredTheme } = await import('../theme');
      expect(getStoredTheme()).toBe('dark');
    });

    it('returns system preference light when not dark', async () => {
      // Mock matchMedia to return light preference
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: vi.fn().mockImplementation((query: string) => ({
          matches: false,
          media: query,
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
        })),
      });

      const { getStoredTheme } = await import('../theme');
      expect(getStoredTheme()).toBe('light');
    });

    it('returns localStorage value over system preference', async () => {
      localStorage.setItem('awsaerospace-theme', 'light');
      
      // Mock matchMedia to return dark preference
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: vi.fn().mockImplementation((query: string) => ({
          matches: query === '(prefers-color-scheme: dark)',
          media: query,
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
        })),
      });

      const { getStoredTheme } = await import('../theme');
      expect(getStoredTheme()).toBe('light');
    });

    it('returns dark from localStorage when stored', async () => {
      localStorage.setItem('awsaerospace-theme', 'dark');

      const { getStoredTheme } = await import('../theme');
      expect(getStoredTheme()).toBe('dark');
    });
  });

  describe('setStoredTheme', () => {
    it('persists dark to localStorage', async () => {
      const { setStoredTheme } = await import('../theme');
      setStoredTheme('dark');
      expect(localStorage.getItem('awsaerospace-theme')).toBe('dark');
    });

    it('persists light to localStorage', async () => {
      const { setStoredTheme } = await import('../theme');
      setStoredTheme('light');
      expect(localStorage.getItem('awsaerospace-theme')).toBe('light');
    });
  });

  describe('watchSystemPreference', () => {
    it('calls callback on system change when no localStorage', async () => {
      const addEventListenerMock = vi.fn();
      const removeEventListenerMock = vi.fn();
      
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: vi.fn().mockImplementation((query: string) => ({
          matches: false,
          media: query,
          addEventListener: addEventListenerMock,
          removeEventListener: removeEventListenerMock,
        })),
      });

      const { watchSystemPreference } = await import('../theme');
      const callback = vi.fn();
      
      watchSystemPreference(callback);
      
      expect(addEventListenerMock).toHaveBeenCalledWith('change', expect.any(Function));
      
      // Simulate matchMedia change event (system switches to dark)
      const handler = addEventListenerMock.mock.calls[0][1];
      handler({ matches: true } as MediaQueryListEvent);
      
      expect(callback).toHaveBeenCalledWith('dark');
    });

    it('does NOT fire when localStorage has a value', async () => {
      localStorage.setItem('awsaerospace-theme', 'light');
      
      const addEventListenerMock = vi.fn();
      const removeEventListenerMock = vi.fn();
      
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: vi.fn().mockImplementation((query: string) => ({
          matches: false,
          media: query,
          addEventListener: addEventListenerMock,
          removeEventListener: removeEventListenerMock,
        })),
      });

      const { watchSystemPreference } = await import('../theme');
      const callback = vi.fn();
      
      watchSystemPreference(callback);
      
      // Simulate matchMedia change event
      const handler = addEventListenerMock.mock.calls[0][1];
      handler({ matches: true } as MediaQueryListEvent);
      
      // Callback should NOT be called because localStorage has a value
      expect(callback).not.toHaveBeenCalled();
    });

    it('returns cleanup function that removes event listener', async () => {
      const addEventListenerMock = vi.fn();
      const removeEventListenerMock = vi.fn();
      
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: vi.fn().mockImplementation((query: string) => ({
          matches: false,
          media: query,
          addEventListener: addEventListenerMock,
          removeEventListener: removeEventListenerMock,
        })),
      });

      const { watchSystemPreference } = await import('../theme');
      const callback = vi.fn();
      
      const cleanup = watchSystemPreference(callback);
      
      expect(addEventListenerMock).toHaveBeenCalledWith('change', expect.any(Function));
      
      // Call cleanup
      cleanup();
      
      const handler = addEventListenerMock.mock.calls[0][1];
      expect(removeEventListenerMock).toHaveBeenCalledWith('change', handler);
    });

    it('calls callback with light when system switches to light', async () => {
      const addEventListenerMock = vi.fn();
      
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: vi.fn().mockImplementation((query: string) => ({
          matches: true,
          media: query,
          addEventListener: addEventListenerMock,
          removeEventListener: vi.fn(),
        })),
      });

      const { watchSystemPreference } = await import('../theme');
      const callback = vi.fn();
      
      watchSystemPreference(callback);
      
      // Simulate matchMedia change event (system switches to light)
      const handler = addEventListenerMock.mock.calls[0][1];
      handler({ matches: false } as MediaQueryListEvent);
      
      expect(callback).toHaveBeenCalledWith('light');
    });
  });
});

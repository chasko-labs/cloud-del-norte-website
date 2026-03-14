import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Ensure ResizeObserver is a proper constructor (class) for Cloudscape internals
class ResizeObserverMock {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
}
globalThis.ResizeObserver = ResizeObserverMock;

// Mock Shell and layout dependencies
// NOTE: 4 levels up because test is in src/pages/learning/api/__tests__/
vi.mock('../../../../layouts/shell', () => ({
  default: ({ children, breadcrumbs }: { children: React.ReactNode; breadcrumbs?: React.ReactNode }) =>
    React.createElement('div', { 'data-testid': 'shell' }, breadcrumbs, children),
}));
vi.mock('../../../../components/navigation', () => ({
  default: () => React.createElement('nav', { 'data-testid': 'navigation' }),
}));
// Breadcrumbs renders active.text so locale-dependent text is testable
vi.mock('../../../../components/breadcrumbs', () => ({
  default: ({ active }: { active: { text: string } }) =>
    React.createElement('nav', { 'aria-label': 'breadcrumbs', 'data-active': active?.text }),
}));

// Mock RiftRewindDashboard to avoid Cloudscape component issues in jsdom
vi.mock('../RiftRewindDashboard', () => ({
  default: () =>
    React.createElement('div', { 'data-testid': 'rift-rewind-dashboard' }),
}));

// Mock theme and locale utilities
vi.mock('../../../../utils/theme', () => ({
  initializeTheme: () => 'light',
  applyTheme: vi.fn(),
  setStoredTheme: vi.fn(),
}));
vi.mock('../../../../utils/locale', () => ({
  initializeLocale: () => 'us',
  applyLocale: vi.fn(),
  setStoredLocale: vi.fn(),
}));

// Mock useTranslation with a mutable return value
const mockTranslation = {
  locale: 'us' as 'us' | 'mx',
  t: (key: string) => key,
};

vi.mock('../../../../hooks/useTranslation', () => ({
  useTranslation: () => mockTranslation,
}));

import App from '../app';

describe('Learning/API page', () => {
  beforeEach(() => {
    mockTranslation.locale = 'us';
    mockTranslation.t = (key: string) => key;
  });

  it('renders the Shell wrapper', () => {
    render(<App />);
    expect(screen.getByTestId('shell')).toBeTruthy();
  });

  it('renders the RiftRewindDashboard content', () => {
    render(<App />);
    expect(screen.getByTestId('rift-rewind-dashboard')).toBeTruthy();
  });

  it('renders English strings when locale is us', () => {
    mockTranslation.locale = 'us';
    mockTranslation.t = (key: string) => {
      const englishMap: Record<string, string> = {
        'navigation.apiGuide': 'API Guide',
      };
      return englishMap[key] ?? key;
    };

    render(<App />);
    // Breadcrumbs receives active.text = t('navigation.apiGuide') from App
    expect(screen.getByRole('navigation', { name: 'breadcrumbs' }).dataset.active).toBe('API Guide');
  });

  it('renders Spanish strings when locale is mx', () => {
    mockTranslation.locale = 'mx';
    mockTranslation.t = (key: string) => {
      const spanishMap: Record<string, string> = {
        'navigation.apiGuide': 'Guía de API',
      };
      return spanishMap[key] ?? key;
    };

    render(<App />);
    // Breadcrumbs receives active.text = t('navigation.apiGuide') from App
    expect(screen.getByRole('navigation', { name: 'breadcrumbs' }).dataset.active).toBe('Guía de API');
  });
});


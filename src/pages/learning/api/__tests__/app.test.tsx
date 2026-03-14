import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyProps = Record<string, any>;

// Mock Shell — AppLayout uses ResizeObserver/timers that hang in jsdom.
// Must render breadcrumbs prop to test locale-dependent breadcrumb text.
vi.mock('../../../../layouts/shell', () => ({
  default: ({ children, breadcrumbs }: AnyProps) =>
    React.createElement('div', { 'data-testid': 'shell' }, breadcrumbs, children),
}));

vi.mock('../../../../components/navigation', () => ({
  default: () => React.createElement('nav', { 'data-testid': 'navigation' }),
}));

vi.mock('../../../../components/breadcrumbs', () => ({
  default: ({ active }: AnyProps) =>
    React.createElement(
      'nav',
      { 'aria-label': 'breadcrumbs' },
      React.createElement('span', { 'data-testid': 'breadcrumb-active' }, active?.text),
    ),
}));

// Mock RiftRewindDashboard to avoid async fetch complexity in tests
vi.mock('../RiftRewindDashboard', () => ({
  default: () => React.createElement('div', { 'data-testid': 'rift-rewind-dashboard' }),
}));

// Mock useTranslation with a mutable return value for locale testing
const mockTranslation = {
  locale: 'us' as 'us' | 'mx',
  t: (key: string) => key,
};

vi.mock('../../../../hooks/useTranslation', () => ({
  useTranslation: () => mockTranslation,
}));

import App from '../app';

describe('Learning API page app', () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    mockTranslation.locale = 'us';
    mockTranslation.t = (key: string) => key;
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it('renders without crashing', () => {
    expect(() => render(<App />)).not.toThrow();
  });

  it('renders the dashboard content', () => {
    render(<App />);
    expect(screen.getByTestId('rift-rewind-dashboard')).toBeTruthy();
  });

  it('renders English breadcrumb text when locale is us', () => {
    mockTranslation.locale = 'us';
    mockTranslation.t = (key: string) => {
      const map: Record<string, string> = {
        'navigation.apiGuide': 'API Guide',
      };
      return map[key] ?? key;
    };

    render(<App />);

    expect(screen.getByTestId('breadcrumb-active')).toBeTruthy();
    expect(screen.getByText('API Guide')).toBeTruthy();
  });

  it('renders Spanish breadcrumb text when locale is mx', () => {
    mockTranslation.locale = 'mx';
    mockTranslation.t = (key: string) => {
      const map: Record<string, string> = {
        'navigation.apiGuide': 'Guía de API',
      };
      return map[key] ?? key;
    };

    render(<App />);

    expect(screen.getByTestId('breadcrumb-active')).toBeTruthy();
    expect(screen.getByText('Guía de API')).toBeTruthy();
  });

  it('no React warnings or errors on render', () => {
    render(<App />);
    const errorCalls = consoleErrorSpy.mock.calls.filter(
      (args: unknown[]) =>
        typeof args[0] === 'string' &&
        (args[0].includes('Warning:') || args[0].includes('Error:')),
    );
    expect(errorCalls).toHaveLength(0);
  });
});

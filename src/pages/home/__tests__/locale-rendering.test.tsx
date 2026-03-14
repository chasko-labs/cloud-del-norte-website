import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyProps = Record<string, any>;

// Mock Cloudscape components
vi.mock('@cloudscape-design/components/content-layout', () => ({
  default: ({ children, header }: AnyProps) =>
    React.createElement('div', { 'data-testid': 'content-layout' }, header, children),
}));
vi.mock('@cloudscape-design/components/grid', () => ({
  default: ({ children }: AnyProps) =>
    React.createElement('div', { 'data-testid': 'grid' }, children),
}));
vi.mock('@cloudscape-design/components/header', () => ({
  default: ({ children, info }: AnyProps) =>
    React.createElement('div', null,
      React.createElement('h1', null, children),
      info
    ),
}));
vi.mock('@cloudscape-design/components/link', () => ({
  default: ({ children }: AnyProps) => React.createElement('a', null, children),
}));

// Mock Shell and dependencies
vi.mock('../../../layouts/shell', () => ({
  default: ({ children }: { children: React.ReactNode }) =>
    React.createElement('div', { 'data-testid': 'shell' }, children),
}));
vi.mock('../../../components/navigation', () => ({
  default: () => React.createElement('nav', { 'data-testid': 'navigation' }),
}));
vi.mock('../../../components/breadcrumbs', () => ({
  default: () => React.createElement('nav', { 'aria-label': 'breadcrumbs' }),
}));

// Mock child components
vi.mock('../components/production-overview', () => ({
  default: () => React.createElement('div', { 'data-testid': 'production-overview' }),
}));
vi.mock('../components/meetings', () => ({
  default: () => React.createElement('div', { 'data-testid': 'meetings' }),
}));
vi.mock('../components/quality-report', () => ({
  default: () => React.createElement('div', { 'data-testid': 'quality-report' }),
}));
vi.mock('../../create-meeting/components/help-panel-home', () => ({
  HelpPanelHome: () => React.createElement('div', { 'data-testid': 'help-panel' }),
}));

// Mock useTranslation with a mutable return value
const mockTranslation = {
  locale: 'us' as 'us' | 'mx',
  t: (key: string) => key,
};

vi.mock('../../../hooks/useTranslation', () => ({
  useTranslation: () => mockTranslation,
}));

import App from '../app';

describe('Home page locale rendering', () => {
  beforeEach(() => {
    mockTranslation.locale = 'us';
    mockTranslation.t = (key: string) => key;
  });

  it('renders Spanish strings when locale is mx', () => {
    mockTranslation.locale = 'mx';
    mockTranslation.t = (key: string) => {
      const spanishMap: Record<string, string> = {
        'dashboardPage.breadcrumb': 'Tablero',
        'dashboardPage.header': 'Tablero',
        'dashboardPage.infoLink': 'Info',
      };
      return spanishMap[key] ?? key;
    };

    render(<App />);

    // Verify Spanish header appears
    expect(screen.getByText('Tablero')).toBeTruthy();
  });

  it('renders English strings when locale is us', () => {
    mockTranslation.locale = 'us';
    mockTranslation.t = (key: string) => {
      const englishMap: Record<string, string> = {
        'dashboardPage.breadcrumb': 'Dashboard',
        'dashboardPage.header': 'Dashboard',
        'dashboardPage.infoLink': 'Info',
      };
      return englishMap[key] ?? key;
    };

    render(<App />);

    // Verify English header appears
    expect(screen.getByText('Dashboard')).toBeTruthy();
  });
});

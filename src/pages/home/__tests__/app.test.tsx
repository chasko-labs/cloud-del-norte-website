import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyProps = Record<string, any>;

// --- Mock Cloudscape components (they hang in jsdom without mocking) ---

vi.mock('@cloudscape-design/components/content-layout', () => ({
  default: ({ children, header }: AnyProps) =>
    React.createElement('div', { 'data-testid': 'content-layout' }, header, children),
}));
vi.mock('@cloudscape-design/components/grid', () => ({
  default: ({ children }: AnyProps) =>
    React.createElement('div', { 'data-testid': 'grid' }, children),
}));
vi.mock('@cloudscape-design/components/header', () => ({
  default: ({ children }: AnyProps) =>
    React.createElement('h2', { 'data-testid': 'header' }, children),
}));
vi.mock('@cloudscape-design/components/link', () => ({
  default: ({ children }: AnyProps) =>
    React.createElement('a', null, children),
}));
vi.mock('@cloudscape-design/components/box', () => ({
  default: ({ children }: AnyProps) =>
    React.createElement('div', { 'data-testid': 'box' }, children),
}));
vi.mock('@cloudscape-design/components/container', () => ({
  default: ({ children, header }: AnyProps) =>
    React.createElement('div', { 'data-testid': 'container' }, header, children),
}));
vi.mock('@cloudscape-design/components/column-layout', () => ({
  default: ({ children }: AnyProps) =>
    React.createElement('div', { 'data-testid': 'column-layout' }, children),
}));
vi.mock('@cloudscape-design/components/button', () => ({
  default: ({ children }: AnyProps) =>
    React.createElement('button', { 'data-testid': 'button' }, children),
}));
vi.mock('@cloudscape-design/components/modal', () => ({
  default: ({ children, visible }: AnyProps) =>
    visible ? React.createElement('div', { 'data-testid': 'modal' }, children) : null,
}));
vi.mock('@cloudscape-design/components/table', () => ({
  default: () =>
    React.createElement('table', { 'data-testid': 'table' }),
}));
vi.mock('@cloudscape-design/components/pie-chart', () => ({
  default: () =>
    React.createElement('div', { 'data-testid': 'pie-chart' }, 'PieChart'),
}));
vi.mock('@cloudscape-design/components/status-indicator', () => ({
  default: ({ children }: AnyProps) =>
    React.createElement('span', { 'data-testid': 'status-indicator' }, children),
}));
// Barrel import (current code) — SpaceBetween is a named export
vi.mock('@cloudscape-design/components', () => ({
  SpaceBetween: ({ children }: AnyProps) =>
    React.createElement('div', { 'data-testid': 'space-between' }, children),
}));
// Deep import (after Lyren's barrel-fix) — SpaceBetween is a default export
vi.mock('@cloudscape-design/components/space-between', () => ({
  default: ({ children }: AnyProps) =>
    React.createElement('div', { 'data-testid': 'space-between' }, children),
}));

// --- Mock Shell, Navigation, Breadcrumbs ---

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
vi.mock('../../create-meeting/components/help-panel-home', () => ({
  HelpPanelHome: () => React.createElement('div', { 'data-testid': 'help-panel' }),
}));

// --- Mock useTranslation (return English strings) ---

vi.mock('../../../hooks/useTranslation', () => ({
  useTranslation: () => ({
    locale: 'us' as const,
    t: (key: string) => {
      const translations: Record<string, string> = {
        'home.breadcrumb': 'Dashboard',
        'home.header': 'Dashboard',
        'home.infoLink': 'Info',
        'home.productionOverviewHeader': 'Production Overview',
        'home.pastTopicsHeader': 'Past Topics',
        'home.userGroupHeader': 'User Group',
        'home.groupNotesModal': 'Group Notes',
        'home.tableHeaders.name': 'Name',
        'home.tableHeaders.status': 'Status',
        'home.tableHeaders.mixing': 'Mixing',
        'home.tableHeaders.molding': 'Molding',
        'home.tableHeaders.strong': 'Strong',
        'home.tableHeaders.mild': 'Mild',
        'home.tableHeaders.unnoticed': 'Unnoticed',
        'home.metrics.communityMembers': 'Community Members',
        'home.metrics.fiveStarReviews': '5 Star Reviews',
        'home.metrics.meetupsHeld': 'Meetups Held',
        'home.metrics.est': 'Est.',
        'home.quote.text': "Holding our first meetup on International Women's Day 2021, we continue to build a community of cloud enthusiasts in the Southwest.",
        'home.communityDescription': "Holding our first meetup on International Women's Day 2021, we continue to build a community of cloud enthusiasts in the Southwest.",
      };
      return translations[key] ?? key;
    },
  }),
}));

import App from '../app';

describe('Home page', () => {
  const consoleSpy = vi.spyOn(console, 'error');

  beforeEach(() => {
    consoleSpy.mockReset();
  });

  it('renders without errors', () => {
    render(<App />);
    expect(consoleSpy).not.toHaveBeenCalled();
  });

  it('renders the Shell layout wrapper', () => {
    render(<App />);
    expect(screen.getByTestId('shell')).toBeTruthy();
  });

  describe('panel rendering', () => {
    it('renders ProductionOverview panel', () => {
      render(<App />);
      expect(screen.getByText('Production Overview')).toBeTruthy();
    });

    it('renders Meetings panel', () => {
      render(<App />);
      expect(screen.getByText('Past Topics')).toBeTruthy();
    });

    it('renders QualityReport panel', () => {
      render(<App />);
      expect(screen.getByText('User Group')).toBeTruthy();
    });
  });

  it('renders community description text', () => {
    render(<App />);
    expect(
      screen.getByText(/Holding our first meetup on International Women's Day/)
    ).toBeTruthy();
  });

  describe('production metrics', () => {
    it('renders all 4 metric labels', () => {
      render(<App />);
      expect(screen.getByText('Community Members')).toBeTruthy();
      expect(screen.getByText('5 Star Reviews')).toBeTruthy();
      expect(screen.getByText('Meetups Held')).toBeTruthy();
      expect(screen.getByText('Est.')).toBeTruthy();
    });

    it('renders all 4 metric values', () => {
      render(<App />);
      expect(screen.getByText('239')).toBeTruthy();
      expect(screen.getByText('15')).toBeTruthy();
      expect(screen.getByText('33')).toBeTruthy();
      expect(screen.getByText('2021')).toBeTruthy();
    });
  });
});

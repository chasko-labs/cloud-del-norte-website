import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LocaleProvider } from '../../../contexts/locale-context';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyProps = Record<string, any>;

// --- Mock Cloudscape components (they hang in jsdom without mocking) ---

vi.mock('@cloudscape-design/components/content-layout', () => ({
  default: ({ children, header }: AnyProps) =>
    React.createElement('div', { 'data-testid': 'content-layout' }, header, children),
}));
vi.mock('@cloudscape-design/components/header', () => ({
  default: ({ children }: AnyProps) =>
    React.createElement('h2', { 'data-testid': 'header' }, children),
}));
vi.mock('@cloudscape-design/components/space-between', () => ({
  default: ({ children }: AnyProps) =>
    React.createElement('div', { 'data-testid': 'space-between' }, children),
}));
vi.mock('@cloudscape-design/components/box', () => ({
  default: ({ children }: AnyProps) =>
    React.createElement('div', { 'data-testid': 'box' }, children),
}));
vi.mock('@cloudscape-design/components/grid', () => ({
  default: ({ children }: AnyProps) =>
    React.createElement('div', { 'data-testid': 'grid' }, children),
}));
vi.mock('@cloudscape-design/components/container', () => ({
  default: ({ children, header }: AnyProps) =>
    React.createElement('div', { 'data-testid': 'container' }, header, children),
}));
vi.mock('@cloudscape-design/components/badge', () => ({
  default: ({ children }: AnyProps) =>
    React.createElement('span', { 'data-testid': 'badge' }, children),
}));

// --- Mock Shell, Navigation, Breadcrumbs ---

vi.mock('../../../layouts/shell', () => ({
  default: ({ children, breadcrumbs }: { children: React.ReactNode; breadcrumbs?: React.ReactNode }) =>
    React.createElement(
      LocaleProvider,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      { locale: 'us' } as any,
      React.createElement('div', { 'data-testid': 'shell' }, breadcrumbs, children)
    ),
}));
vi.mock('../../../components/navigation', () => ({
  default: () => React.createElement('nav', { 'data-testid': 'navigation' }),
}));
vi.mock('../../../components/breadcrumbs', () => ({
  default: () => React.createElement('nav', { 'aria-label': 'breadcrumbs' }),
}));

// --- Mock useTranslation (return English strings) ---

vi.mock('../../../hooks/useTranslation', () => ({
  useTranslation: () => ({
    locale: 'us' as const,
    t: (key: string) => {
      const translations: Record<string, string> = {
        'roadmap.title': 'Roadmap',
        'roadmap.breadcrumb': 'Roadmap',
        'roadmap.idea': 'Idea',
        'roadmap.todo': 'To Do',
        'roadmap.inProgress': 'In Progress',
        'roadmap.inReview': 'In Review',
        'roadmap.done': 'Done',
      };
      return translations[key] ?? key;
    },
  }),
}));

// --- Mock ResizeObserver (Cloudscape uses it internally) ---

class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}

globalThis.ResizeObserver = ResizeObserverMock as any;

import App from '../app';

describe('Roadmap page', () => {
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

  it('renders page header', () => {
    render(<App />);
    expect(screen.getByText('Roadmap')).toBeTruthy();
  });

  describe('board columns', () => {
    it('renders all 5 column headers', () => {
      render(<App />);
      expect(screen.getByText('Idea')).toBeTruthy();
      expect(screen.getByText('To Do')).toBeTruthy();
      expect(screen.getByText('In Progress')).toBeTruthy();
      expect(screen.getByText('In Review')).toBeTruthy();
      expect(screen.getByText('Done')).toBeTruthy();
    });

    it('renders cards in Idea column', () => {
      render(<App />);
      expect(screen.getByText('SCRUM-21')).toBeTruthy();
      expect(screen.getByText('SCRUM-22')).toBeTruthy();
      expect(screen.getByText('SCRUM-23')).toBeTruthy();
      expect(screen.getByText('SCRUM-24')).toBeTruthy();
    });

    it('renders cards in To Do column', () => {
      render(<App />);
      expect(screen.getByText('SCRUM-17')).toBeTruthy();
      expect(screen.getByText('SCRUM-18')).toBeTruthy();
      expect(screen.getByText('SCRUM-19')).toBeTruthy();
      expect(screen.getByText('SCRUM-20')).toBeTruthy();
    });

    it('renders cards in In Progress column', () => {
      render(<App />);
      expect(screen.getByText('SCRUM-9')).toBeTruthy();
      expect(screen.getByText('SCRUM-10')).toBeTruthy();
      expect(screen.getByText('SCRUM-14')).toBeTruthy();
      expect(screen.getByText('SCRUM-15')).toBeTruthy();
      expect(screen.getByText('SCRUM-16')).toBeTruthy();
    });

    it('renders cards in In Review column', () => {
      render(<App />);
      expect(screen.getByText('SCRUM-5')).toBeTruthy();
      expect(screen.getByText('SCRUM-6')).toBeTruthy();
      expect(screen.getByText('SCRUM-7')).toBeTruthy();
      expect(screen.getByText('SCRUM-8')).toBeTruthy();
    });

    it('renders cards in Done column', () => {
      render(<App />);
      expect(screen.getByText('SCRUM-1')).toBeTruthy();
      expect(screen.getByText('SCRUM-2')).toBeTruthy();
    });
  });

  describe('SCRUM card IDs', () => {
    it('renders at least 19 SCRUM card IDs', () => {
      render(<App />);
      // Total cards: 4 (Idea) + 4 (To Do) + 5 (In Progress) + 4 (In Review) + 2 (Done) = 19
      const scrumCards = screen.getAllByText(/^SCRUM-\d+$/);
      expect(scrumCards.length).toBeGreaterThanOrEqual(19);
    });
  });
});

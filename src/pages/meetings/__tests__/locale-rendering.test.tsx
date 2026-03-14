import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyProps = Record<string, any>;

// Mock Cloudscape components
vi.mock('@cloudscape-design/components/table', () => ({
  default: ({ header, items, columnDefinitions }: AnyProps) =>
    React.createElement('div', { 'data-testid': 'table' },
      header,
      (items ?? []).map((_: unknown, i: number) =>
        React.createElement('div', { key: i, 'data-testid': 'table-row' },
          (columnDefinitions ?? []).map((col: AnyProps) =>
            React.createElement('div', { key: col.id, 'data-testid': `cell-${col.id}` }, col.cell?.((items ?? [])[i]))
          )
        )
      )
    ),
}));
vi.mock('@cloudscape-design/components/header', () => ({
  default: ({ children, actions }: AnyProps) =>
    React.createElement('div', null,
      React.createElement('h1', null, children),
      actions
    ),
}));
vi.mock('@cloudscape-design/components/button', () => ({
  default: ({ children, onClick }: AnyProps) =>
    React.createElement('button', { onClick }, children),
}));
vi.mock('@cloudscape-design/components/space-between', () => ({
  default: ({ children }: AnyProps) => React.createElement('div', null, children),
}));
vi.mock('@cloudscape-design/components/pagination', () => ({
  default: () => React.createElement('div', { 'data-testid': 'pagination' }),
}));
vi.mock('@cloudscape-design/components/text-filter', () => ({
  default: ({ filteringPlaceholder }: AnyProps) =>
    React.createElement('input', { placeholder: filteringPlaceholder }),
}));
vi.mock('@cloudscape-design/components/collection-preferences', () => ({
  default: () => React.createElement('div', { 'data-testid': 'collection-preferences' }),
}));
vi.mock('@cloudscape-design/components/box', () => ({
  default: ({ children }: AnyProps) => React.createElement('div', null, children),
}));
vi.mock('@cloudscape-design/collection-hooks', () => ({
  useCollection: (_items: unknown[], _opts: AnyProps) => ({
    items: [],
    filterProps: { filteringText: '', onChange: vi.fn() },
    actions: { setFiltering: vi.fn() },
    filteredItemsCount: 0,
    paginationProps: { currentPageIndex: 1, pagesCount: 1, onChange: vi.fn() },
    collectionProps: { selectedItems: [], onSelectionChange: vi.fn(), sortingColumn: null, sortingDescending: false, onSortingChange: vi.fn() },
  }),
}));

// Mock Shell — render breadcrumbs and children so breadcrumb text is testable
vi.mock('../../../layouts/shell', () => ({
  default: ({ children, breadcrumbs }: AnyProps) =>
    React.createElement('div', { 'data-testid': 'shell' }, breadcrumbs, children),
}));

// Mock Breadcrumbs — render active.text so locale-dependent text is visible
vi.mock('../../../components/breadcrumbs', () => ({
  default: ({ active }: AnyProps) =>
    React.createElement('nav', { 'aria-label': 'breadcrumbs' },
      React.createElement('span', { 'data-testid': 'breadcrumb-active' }, active?.text)
    ),
}));

vi.mock('../../../components/navigation', () => ({
  default: () => React.createElement('nav', { 'data-testid': 'navigation' }),
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

describe('Meetings page locale rendering', () => {
  beforeEach(() => {
    mockTranslation.locale = 'us';
    mockTranslation.t = (key: string) => key;
  });

  it('renders Spanish breadcrumb when locale is mx', () => {
    mockTranslation.locale = 'mx';
    mockTranslation.t = (key: string) => {
      const spanishMap: Record<string, string> = {
        'meetings.breadcrumb': 'Juntas',
      };
      return spanishMap[key] ?? key;
    };

    render(<App />);

    expect(screen.getByTestId('breadcrumb-active').textContent).toBe('Juntas');
  });

  it('renders English breadcrumb when locale is us', () => {
    mockTranslation.locale = 'us';
    mockTranslation.t = (key: string) => {
      const englishMap: Record<string, string> = {
        'meetings.breadcrumb': 'Meetings',
      };
      return englishMap[key] ?? key;
    };

    render(<App />);

    expect(screen.getByTestId('breadcrumb-active').textContent).toBe('Meetings');
  });

  it('renders without crashing', () => {
    expect(() => render(<App />)).not.toThrow();
  });
});

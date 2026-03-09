import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyProps = Record<string, any>;

vi.mock('@cloudscape-design/components/table', () => ({
  default: ({ header, items, columnDefinitions }: AnyProps) =>
    React.createElement('div', { 'data-testid': 'table' },
      header,
      items.map((_: unknown, i: number) =>
        React.createElement('div', { key: i, 'data-testid': 'table-row' },
          columnDefinitions.map((col: AnyProps) =>
            React.createElement('div', { key: col.id, 'data-testid': `cell-${col.id}` }, col.cell(items[i]))
          )
        )
      )
    ),
}));
vi.mock('@cloudscape-design/components/select', () => ({
  default: ({ ariaLabel, options }: AnyProps) =>
    React.createElement('select', { 'aria-label': ariaLabel },
      options?.map((o: AnyProps) => React.createElement('option', { key: o.value, value: o.value }, o.label))
    ),
}));
vi.mock('@cloudscape-design/components/button', () => ({
  default: ({ children, onClick }: AnyProps) =>
    React.createElement('button', { onClick }, children),
}));
vi.mock('@cloudscape-design/components/header', () => ({
  default: ({ children, actions }: AnyProps) =>
    React.createElement('div', null,
      React.createElement('h1', null, children),
      actions
    ),
}));
vi.mock('@cloudscape-design/components/content-layout', () => ({
  default: ({ children, header }: AnyProps) =>
    React.createElement('div', null, header, children),
}));
vi.mock('@cloudscape-design/components/space-between', () => ({
  default: ({ children }: AnyProps) => React.createElement('div', null, children),
}));
vi.mock('@cloudscape-design/components/badge', () => ({
  default: ({ children }: AnyProps) => React.createElement('span', null, children),
}));
vi.mock('@cloudscape-design/components/box', () => ({
  default: ({ children }: AnyProps) => React.createElement('div', null, children),
}));
vi.mock('@cloudscape-design/components/link', () => ({
  default: ({ children, href }: AnyProps) => React.createElement('a', { href }, children),
}));

import MaintenanceCalendar from '../MaintenanceCalendar';

// Mock URL.createObjectURL / revokeObjectURL (not in jsdom)
globalThis.URL.createObjectURL = vi.fn(() => 'blob:mock');
globalThis.URL.revokeObjectURL = vi.fn();

// Mock ical utils to avoid blob/anchor click side-effects in jsdom
vi.mock('../utils/ical', () => ({
  generateICS: vi.fn(() => ''),
  generateICSForTech: vi.fn(() => ''),
  downloadICS: vi.fn(),
}));

// Mock ShellLayout — AppLayout uses ResizeObserver/timers that hang in jsdom
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

describe('maintenance-calendar page', () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it('renders without crashing', () => {
    expect(() => render(<MaintenanceCalendar />)).not.toThrow();
  });

  it('page heading is present', () => {
    render(<MaintenanceCalendar />);
    expect(screen.getByRole('heading', { name: /maintenance calendar/i })).toBeTruthy();
  });

  it('at least one tech name from seed data is visible', () => {
    render(<MaintenanceCalendar />);
    // Python is the first entry in releases.seed.json
    expect(screen.getByText('Python')).toBeTruthy();
  });

  it('Export All button is present', () => {
    render(<MaintenanceCalendar />);
    expect(screen.getByText(/export all/i)).toBeTruthy();
  });

  it('category filter is present', () => {
    render(<MaintenanceCalendar />);
    // The Select renders a combobox with the ariaLabel "Filter by category"
    expect(screen.getByRole('combobox', { name: /filter by category/i })).toBeTruthy();
  });

  it('no React warnings or errors on render', () => {
    render(<MaintenanceCalendar />);
    const errorCalls = consoleErrorSpy.mock.calls.filter((args: unknown[]) =>
      typeof args[0] === 'string' && (args[0].includes('Warning:') || args[0].includes('Error:'))
    );
    expect(errorCalls).toHaveLength(0);
  });
});

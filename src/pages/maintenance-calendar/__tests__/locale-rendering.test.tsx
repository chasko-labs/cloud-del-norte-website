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
  default: ({ children, actions, variant }: AnyProps) =>
    React.createElement('div', null,
      React.createElement(variant === 'h2' ? 'h2' : 'h1', null, children),
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

// Mock layout components
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

// Mock ical utils
vi.mock('../utils/ical', () => ({
  generateICS: vi.fn(() => ''),
  generateICSForTech: vi.fn(() => ''),
  downloadICS: vi.fn(),
}));

globalThis.URL.createObjectURL = vi.fn(() => 'blob:mock');
globalThis.URL.revokeObjectURL = vi.fn();

// Mock useTranslation with a mutable return value
const mockTranslation = {
  locale: 'us' as 'us' | 'mx',
  t: (key: string) => key,
};

vi.mock('../../../hooks/useTranslation', () => ({
  useTranslation: () => mockTranslation,
}));

import MaintenanceCalendar from '../MaintenanceCalendar';

describe('Maintenance Calendar locale rendering', () => {
  beforeEach(() => {
    mockTranslation.locale = 'us';
    mockTranslation.t = (key: string) => key;
  });

  it('renders Spanish strings when locale is mx', () => {
    mockTranslation.locale = 'mx';
    mockTranslation.t = (key: string) => {
      const spanishMap: Record<string, string> = {
        'maintenanceCalendar.header': 'Calendario de Mantenimiento',
        'maintenanceCalendar.breadcrumb': 'Calendario de Mantenimiento',
        'maintenanceCalendar.description': 'Rastrea los calendarios de versiones LTS y lanzamientos para tecnologías cloud-native.',
        'maintenanceCalendar.exportAll': 'Exportar Todos',
        'maintenanceCalendar.export': 'Exportar',
        'maintenanceCalendar.filterByCategory': 'Filtrar por categoría',
        'maintenanceCalendar.allCategories': 'Todas las categorías',
        'maintenanceCalendar.noDataAvailable': 'No hay datos disponibles',
        'maintenanceCalendar.releaseNotes': 'Notas de lanzamiento',
        'maintenanceCalendar.source': 'Fuente',
        'maintenanceCalendar.tableHeaders.mostRecentLTS': 'LTS más reciente',
        'maintenanceCalendar.tableHeaders.priorLTS': 'LTS anterior',
        'maintenanceCalendar.tableHeaders.secondPriorLTS': '2° LTS anterior',
        'maintenanceCalendar.tableHeaders.mostRecentRelease': 'Lanzamiento más reciente',
        'maintenanceCalendar.tableHeaders.projectedNextRelease': 'Próximo lanzamiento proyectado',
        'maintenanceCalendar.tableHeaders.projectedNextLTS': 'Próximo LTS proyectado',
      };
      return spanishMap[key] ?? key;
    };

    render(<MaintenanceCalendar />);

    // Verify key Spanish strings appear
    expect(screen.getByText('Calendario de Mantenimiento')).toBeTruthy();
    expect(screen.getByText('Todas las categorías')).toBeTruthy();
    expect(screen.getByText('Exportar Todos')).toBeTruthy();
  });

  it('renders English strings when locale is us', () => {
    mockTranslation.locale = 'us';
    mockTranslation.t = (key: string) => {
      const englishMap: Record<string, string> = {
        'maintenanceCalendar.header': 'Maintenance Calendar',
        'maintenanceCalendar.breadcrumb': 'Maintenance Calendar',
        'maintenanceCalendar.description': 'Track LTS and release schedules across cloud-native technologies.',
        'maintenanceCalendar.exportAll': 'Export All',
        'maintenanceCalendar.export': 'Export',
        'maintenanceCalendar.filterByCategory': 'Filter by category',
        'maintenanceCalendar.allCategories': 'All categories',
        'maintenanceCalendar.noDataAvailable': 'No data available',
        'maintenanceCalendar.releaseNotes': 'Release notes',
        'maintenanceCalendar.source': 'Source',
        'maintenanceCalendar.tableHeaders.mostRecentLTS': 'Most Recent LTS',
        'maintenanceCalendar.tableHeaders.priorLTS': 'Prior LTS',
        'maintenanceCalendar.tableHeaders.secondPriorLTS': '2nd Prior LTS',
        'maintenanceCalendar.tableHeaders.mostRecentRelease': 'Most Recent Release',
        'maintenanceCalendar.tableHeaders.projectedNextRelease': 'Projected Next Release',
        'maintenanceCalendar.tableHeaders.projectedNextLTS': 'Projected Next LTS',
      };
      return englishMap[key] ?? key;
    };

    render(<MaintenanceCalendar />);

    // Verify key English strings appear
    expect(screen.getByText('Maintenance Calendar')).toBeTruthy();
    expect(screen.getByText('All categories')).toBeTruthy();
    expect(screen.getByText('Export All')).toBeTruthy();
  });
});

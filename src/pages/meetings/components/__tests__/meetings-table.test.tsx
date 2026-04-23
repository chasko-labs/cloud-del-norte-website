import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AuthContext } from '../../../../contexts/auth-context';
import type { AuthState } from '../../../../contexts/auth-context';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyProps = Record<string, any>;

class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver = ResizeObserverMock as unknown as typeof ResizeObserver;

vi.mock('@cloudscape-design/components/table', () => ({
  default: ({ header }: AnyProps) =>
    React.createElement('div', { 'data-testid': 'table' }, header),
}));
vi.mock('@cloudscape-design/components/header', () => ({
  default: ({ children, actions }: AnyProps) =>
    React.createElement('div', null,
      React.createElement('h1', null, children),
      actions
    ),
}));
vi.mock('@cloudscape-design/components/button', () => ({
  default: ({ children, onClick, href }: AnyProps) =>
    React.createElement('button', { onClick, 'data-href': href }, children),
}));
vi.mock('@cloudscape-design/components/space-between', () => ({
  default: ({ children }: AnyProps) => React.createElement('div', null, children),
}));
vi.mock('@cloudscape-design/components/pagination', () => ({
  default: () => React.createElement('div', { 'data-testid': 'pagination' }),
}));
vi.mock('@cloudscape-design/components/modal', () => ({
  default: ({ children, visible, header }: AnyProps) =>
    visible
      ? React.createElement('div', { 'data-testid': 'modal' },
          React.createElement('div', { 'data-testid': 'modal-header' }, header),
          children
        )
      : null,
}));
vi.mock('../jitsi-embed', () => ({
  default: ({ roomName }: AnyProps) =>
    React.createElement('div', { 'data-testid': 'jitsi-embed-stub', 'data-room': roomName }),
}));
vi.mock('@cloudscape-design/components/text-filter', () => ({
  default: () => React.createElement('div', { 'data-testid': 'text-filter' }),
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
vi.mock('../../../../hooks/useTranslation', () => ({
  useTranslation: () => ({ locale: 'us', t: (k: string) => k }),
}));

import VariationsTable from '../meetings-table';

function authState(overrides: Partial<AuthState> = {}): AuthState {
  return {
    isAuthenticated: true,
    idToken: 'tok',
    email: 'a@b.co',
    name: 'alice',
    groups: [],
    isModerator: false,
    signOut: vi.fn(),
    ...overrides,
  };
}

function renderWithAuth(state: AuthState) {
  return render(
    <AuthContext.Provider value={state}>
      <VariationsTable meetings={[]} />
    </AuthContext.Provider>,
  );
}

describe('VariationsTable — instant meet button visibility', () => {
  beforeEach(() => {
    // Stub crypto.getRandomValues for deterministic room names in tests
    vi.spyOn(crypto, 'getRandomValues').mockImplementation((arr) => {
      if (arr instanceof Uint8Array) {
        arr[0] = 0xab;
        arr[1] = 0xcd;
        arr[2] = 0xef;
      }
      return arr;
    });
  });

  it('moderator sees the "instant meet" button in the header', () => {
    renderWithAuth(authState({ isModerator: true }));
    expect(screen.getByText('instant meet')).toBeInTheDocument();
  });

  it('non-moderator does not see the "instant meet" button', () => {
    renderWithAuth(authState({ isModerator: false }));
    expect(screen.queryByText('instant meet')).not.toBeInTheDocument();
  });

  it('clicking "instant meet" opens modal with a UUID-ish roomName', () => {
    renderWithAuth(authState({ isModerator: true }));

    // Modal should not be visible before click
    expect(screen.queryByTestId('modal')).not.toBeInTheDocument();

    fireEvent.click(screen.getByText('instant meet'));

    // Modal should now be visible
    expect(screen.getByTestId('modal')).toBeInTheDocument();

    // JitsiEmbed stub should be rendered with the synthesized room name
    const embed = screen.getByTestId('jitsi-embed-stub');
    const roomName = embed.getAttribute('data-room') ?? '';
    expect(roomName).toMatch(/^instant-[0-9a-f]{6}$/);
  });
});

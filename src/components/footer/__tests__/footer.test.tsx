import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyProps = Record<string, any>;

// --- Cloudscape component mocks (avoid jsdom hangs) ---

vi.mock('@cloudscape-design/components/box', () => ({
  default: ({ children }: AnyProps) => React.createElement('div', { 'data-testid': 'box' }, children),
}));
vi.mock('@cloudscape-design/components/space-between', () => ({
  default: ({ children }: AnyProps) => React.createElement('div', null, children),
}));
vi.mock('@cloudscape-design/components/link', () => ({
  default: ({ children, href, external }: AnyProps) =>
    React.createElement('a', { href, target: external ? '_blank' : undefined }, children),
}));
vi.mock('@cloudscape-design/components/badge', () => ({
  default: ({ children }: AnyProps) => React.createElement('span', { 'data-testid': 'badge' }, children),
}));
vi.mock('@cloudscape-design/components/header', () => ({
  default: ({ children }: AnyProps) => React.createElement('h2', null, children),
}));

// --- Mock LeaderCard to isolate Footer tests ---

vi.mock('../leader-card', () => ({
  default: ({ leader }: AnyProps) =>
    React.createElement('div', { 'data-testid': `leader-card-${leader.id}` }, leader.name),
}));

import Footer from '../index';

describe('Footer component', () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it('renders without crashing', () => {
    expect(() => render(<Footer />)).not.toThrow();
  });

  it('has role="contentinfo" on the footer element', () => {
    render(<Footer />);
    expect(screen.getByRole('contentinfo')).toBeTruthy();
  });

  it('has id="site-footer"', () => {
    const { container } = render(<Footer />);
    expect(container.querySelector('#site-footer')).toBeTruthy();
  });

  it('renders all 6 leader cards', () => {
    render(<Footer />);
    expect(screen.getByTestId('leader-card-bryan-chasko')).toBeTruthy();
    expect(screen.getByTestId('leader-card-jacob-wright')).toBeTruthy();
    expect(screen.getByTestId('leader-card-andres-moreno')).toBeTruthy();
    expect(screen.getByTestId('leader-card-wayne-savage')).toBeTruthy();
    expect(screen.getByTestId('leader-card-open-slot-en')).toBeTruthy();
    expect(screen.getByTestId('leader-card-open-slot-es')).toBeTruthy();
  });

  it('renders leader names correctly via mocked LeaderCard', () => {
    render(<Footer />);
    expect(screen.getByText('Bryan Chasko')).toBeTruthy();
    expect(screen.getByText('Jacob Wright')).toBeTruthy();
    expect(screen.getByText('Andres Moreno')).toBeTruthy();
    expect(screen.getByText('Wayne Savage')).toBeTruthy();
    expect(screen.getByText('This Could Be You')).toBeTruthy();
    expect(screen.getByText('Esto Podrías Ser Tú')).toBeTruthy();
  });

  it('renders bottom bar with community description', () => {
    render(<Footer />);
    const footer = screen.getByRole('contentinfo');
    expect(footer.textContent).toContain('AWS User Group Cloud Del Norte is part of');
    expect(footer.textContent).toContain('Go Build');
  });

  it('no React warnings or errors on render', () => {
    render(<Footer />);
    const errorCalls = consoleErrorSpy.mock.calls.filter((args: unknown[]) =>
      typeof args[0] === 'string' && (args[0].includes('Warning:') || args[0].includes('Error:'))
    );
    expect(errorCalls).toHaveLength(0);
  });
});

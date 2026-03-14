import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyProps = Record<string, any>;

vi.mock('@cloudscape-design/components/badge', () => ({
  default: ({ children, color }: AnyProps) =>
    React.createElement('span', { 'data-testid': 'badge', 'data-color': color }, children),
}));

vi.mock('@cloudscape-design/components/box', () => ({
  default: ({ children }: AnyProps) => React.createElement('div', null, children),
}));

vi.mock('@cloudscape-design/components/link', () => ({
  default: ({ children, href }: AnyProps) =>
    React.createElement('a', { href }, children),
}));

vi.mock('@cloudscape-design/components/space-between', () => ({
  default: ({ children }: AnyProps) => React.createElement('div', null, children),
}));

import Footer from '../index';

describe('Footer', () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it('renders all 8 leader cards', () => {
    render(<Footer />);
    expect(screen.getByTestId('leader-card-bryan-chasko')).toBeTruthy();
    expect(screen.getByTestId('leader-card-open-slot-co-organizer')).toBeTruthy();
    expect(screen.getByTestId('leader-card-open-slot-content')).toBeTruthy();
    expect(screen.getByTestId('leader-card-open-slot-community')).toBeTruthy();
    expect(screen.getByTestId('leader-card-open-slot-en')).toBeTruthy();
    expect(screen.getByTestId('leader-card-open-slot-es')).toBeTruthy();
    expect(screen.getByTestId('leader-card-open-slot-asl')).toBeTruthy();
    expect(screen.getByTestId('leader-card-open-slot-lsm')).toBeTruthy();
  });

  it('renders ASL leader card with correct name', () => {
    render(<Footer />);
    expect(screen.getByText('ASL Leader Wanted')).toBeTruthy();
  });

  it('renders LSM leader card with correct name', () => {
    render(<Footer />);
    expect(screen.getByText('Líder de LSM Buscado')).toBeTruthy();
  });

  it('renders placeholder badges for all 7 open slots', () => {
    render(<Footer />);
    const badges = screen.getAllByTestId('badge');
    expect(badges.length).toBe(7);
  });

  it('renders Meetup CTA links for all 7 open slots', () => {
    render(<Footer />);
    const meetupLinks = screen.getAllByText('Join us on Meetup →');
    expect(meetupLinks.length).toBe(7);
  });

  it('renders without crashing', () => {
    expect(() => render(<Footer />)).not.toThrow();
  });

  it('renders no React warnings or errors', () => {
    render(<Footer />);
    const errorCalls = consoleErrorSpy.mock.calls.filter((args: unknown[]) =>
      typeof args[0] === 'string' && (args[0].includes('Warning:') || args[0].includes('Error:'))
    );
    expect(errorCalls).toHaveLength(0);
  });
});

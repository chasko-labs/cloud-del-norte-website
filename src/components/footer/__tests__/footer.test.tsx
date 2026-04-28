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

import Footer from '../index';
import { LocaleProvider } from '../../../contexts/locale-context';

// Helper to wrap Footer in LocaleProvider
const renderFooter = () => {
  return render(
    <LocaleProvider locale="us">
      <Footer />
    </LocaleProvider>,
  );
};

describe('Footer component', () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it('renders without crashing', () => {
    expect(() => renderFooter()).not.toThrow();
  });

  it('has role="contentinfo" on the footer element', () => {
    renderFooter();
    expect(screen.getByRole('contentinfo')).toBeTruthy();
  });

  it('has id="site-footer"', () => {
    const { container } = renderFooter();
    expect(container.querySelector('#site-footer')).toBeTruthy();
  });

  it('does not render leader cards — leaders moved to info panel', () => {
    const { container } = renderFooter();
    expect(container.querySelector('[data-testid^="leader-card-"]')).toBeNull();
  });

  it('renders community description with "Go Build" text', () => {
    renderFooter();
    const footer = screen.getByRole('contentinfo');
    expect(footer.textContent).toContain('AWS User Group Cloud Del Norte is part of');
    expect(footer.textContent).toContain('Go Build');
  });

  it('renders "Global AWS User Group Community" as a link', () => {
    renderFooter();
    const link = screen.getByText('Global AWS User Group Community');
    expect(link).toBeTruthy();
    expect(link.tagName).toBe('A');
    expect(link.getAttribute('href')).toContain('meetup.com/pro/global-aws-user-group-community');
  });

  it('no React warnings or errors on render', () => {
    renderFooter();
    const errorCalls = consoleErrorSpy.mock.calls.filter(
      (args: unknown[]) => typeof args[0] === 'string' && (args[0].includes('Warning:') || args[0].includes('Error:')),
    );
    expect(errorCalls).toHaveLength(0);
  });
});

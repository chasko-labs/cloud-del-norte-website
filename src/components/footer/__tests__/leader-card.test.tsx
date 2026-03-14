import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyProps = Record<string, any>;

// --- Cloudscape component mocks ---

vi.mock('@cloudscape-design/components/box', () => ({
  default: ({ children }: AnyProps) => React.createElement('div', { 'data-testid': 'box' }, children),
}));
vi.mock('@cloudscape-design/components/space-between', () => ({
  default: ({ children }: AnyProps) => React.createElement('div', null, children),
}));
vi.mock('@cloudscape-design/components/link', () => ({
  default: ({ children, href, external, ariaLabel }: AnyProps) =>
    React.createElement('a', {
      href,
      target: external ? '_blank' : undefined,
      'aria-label': ariaLabel,
    }, children),
}));
vi.mock('@cloudscape-design/components/badge', () => ({
  default: ({ children }: AnyProps) => React.createElement('span', { 'data-testid': 'badge' }, children),
}));

import LeaderCard from '../leader-card';

// --- Test data ---

const leaderWithAllSocials = {
  id: 'bryan-chasko',
  name: 'Bryan Chasko',
  role: 'Founder & Organizer',
  bio: 'Building community in the cloud.',
  organization: null,
  social: {
    github: 'BryanChasko',
    linkedin: 'bryanchasko',
    twitter: 'BryanChasko',
    website: null,
    meetup: 'https://www.meetup.com/awsugclouddelnorte/',
  },
  placeholder: false,
  retired: false,
};

const leaderMinimalSocials = {
  id: 'jacob-wright',
  name: 'Jacob Wright',
  role: 'Founder & Doña Ana County Lead',
  bio: '',
  organization: null,
  social: {
    github: null,
    linkedin: 'jrwright121',
    twitter: null,
    website: null,
    meetup: null,
  },
  placeholder: false,
  retired: false,
};

const leaderAllSocialsPopulated = {
  id: 'andres-moreno',
  name: 'Andres Moreno',
  role: 'Co-organizer',
  bio: '',
  organization: null,
  social: {
    github: 'andmoredev',
    linkedin: null,
    twitter: 'andmoredev',
    website: 'https://andmore.dev',
    meetup: null,
  },
  placeholder: false,
  retired: false,
};

const placeholderLeader = {
  id: 'open-slot-en',
  name: 'This Could Be You',
  role: 'Future Leader',
  bio: '',
  organization: null,
  social: {
    github: null,
    linkedin: null,
    twitter: null,
    website: null,
    meetup: 'https://www.meetup.com/awsugclouddelnorte/',
  },
  placeholder: true,
  retired: false,
};

describe('LeaderCard component', () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it('renders leader name', () => {
    render(<LeaderCard leader={leaderWithAllSocials} />);
    expect(screen.getByText('Bryan Chasko')).toBeTruthy();
  });

  it('renders leader role as a Badge', () => {
    render(<LeaderCard leader={leaderWithAllSocials} />);
    expect(screen.getByText('Founder & Organizer')).toBeTruthy();
    // Role should appear inside a Badge (mocked as <span data-testid="badge">)
    const badges = screen.getAllByTestId('badge');
    const roleBadge = badges.find((el) => el.textContent === 'Founder & Organizer');
    expect(roleBadge).toBeTruthy();
  });

  it('renders GitHub social link when provided', () => {
    render(<LeaderCard leader={leaderWithAllSocials} />);
    const links = screen.getAllByRole('link');
    const githubLink = links.find((el) => el.getAttribute('href')?.includes('github.com'));
    expect(githubLink).toBeTruthy();
  });

  it('renders LinkedIn social link when provided', () => {
    render(<LeaderCard leader={leaderMinimalSocials} />);
    const links = screen.getAllByRole('link');
    const linkedinLink = links.find((el) => el.getAttribute('href')?.includes('linkedin.com'));
    expect(linkedinLink).toBeTruthy();
  });

  it('renders Twitter/X social link when provided', () => {
    render(<LeaderCard leader={leaderAllSocialsPopulated} />);
    const links = screen.getAllByRole('link');
    const twitterLink = links.find((el) => {
      const href = el.getAttribute('href') || '';
      return href.includes('twitter.com') || href.includes('x.com');
    });
    expect(twitterLink).toBeTruthy();
  });

  it('renders website social link when provided', () => {
    render(<LeaderCard leader={leaderAllSocialsPopulated} />);
    const links = screen.getAllByRole('link');
    const websiteLink = links.find((el) => el.getAttribute('href')?.includes('andmore.dev'));
    expect(websiteLink).toBeTruthy();
  });

  it('renders meetup social link when provided', () => {
    render(<LeaderCard leader={leaderWithAllSocials} />);
    const links = screen.getAllByRole('link');
    const meetupLink = links.find((el) => el.getAttribute('href')?.includes('meetup.com'));
    expect(meetupLink).toBeTruthy();
  });

  it('skips social links that are null', () => {
    render(<LeaderCard leader={leaderMinimalSocials} />);
    const links = screen.getAllByRole('link');
    // Jacob only has LinkedIn — no GitHub, Twitter, website, or meetup links
    const githubLink = links.find((el) => el.getAttribute('href')?.includes('github.com'));
    const twitterLink = links.find((el) => {
      const href = el.getAttribute('href') || '';
      return href.includes('twitter.com') || href.includes('x.com');
    });
    const websiteLink = links.find((el) => el.getAttribute('href')?.includes('andmore.dev'));
    expect(githubLink).toBeUndefined();
    expect(twitterLink).toBeUndefined();
    expect(websiteLink).toBeUndefined();
  });

  it('renders placeholder variant differently', () => {
    const { container } = render(<LeaderCard leader={placeholderLeader} />);
    // Placeholder cards should have distinguishable markup (e.g., a CSS class or data attribute)
    const card = container.firstElementChild;
    expect(card).toBeTruthy();
    // Check for placeholder indicator — class name, data attribute, or different styling
    const hasPlaceholderIndicator =
      card?.classList.toString().includes('placeholder') ||
      card?.getAttribute('data-placeholder') === 'true' ||
      card?.querySelector('[data-placeholder]') !== null;
    expect(hasPlaceholderIndicator).toBe(true);
  });

  it('has accessible link text for social links', () => {
    render(<LeaderCard leader={leaderWithAllSocials} />);
    const links = screen.getAllByRole('link');
    // Every social link should have text content or aria-label for accessibility
    links.forEach((link) => {
      const hasAccessibleName =
        (link.textContent && link.textContent.trim().length > 0) ||
        link.getAttribute('aria-label');
      expect(hasAccessibleName).toBeTruthy();
    });
  });

  it('handles empty bio gracefully', () => {
    // All test leaders have empty bios — rendering should not crash or show "undefined"
    const { container } = render(<LeaderCard leader={leaderMinimalSocials} />);
    expect(container.textContent).not.toContain('undefined');
    expect(container.textContent).not.toContain('null');
  });

  it('no React warnings or errors on render', () => {
    render(<LeaderCard leader={leaderWithAllSocials} />);
    const errorCalls = consoleErrorSpy.mock.calls.filter((args: unknown[]) =>
      typeof args[0] === 'string' && (args[0].includes('Warning:') || args[0].includes('Error:'))
    );
    expect(errorCalls).toHaveLength(0);
  });
});

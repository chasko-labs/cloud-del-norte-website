import React from 'react';
import Box from '@cloudscape-design/components/box';
import Badge from '@cloudscape-design/components/badge';
import Link from '@cloudscape-design/components/link';

export interface Leader {
  id: string;
  name: string;
  role: string;
  bio: string;
  social: {
    github: string | null;
    linkedin: string | null;
    twitter: string | null;
    website: string | null;
    meetup: string | null;
  };
  placeholder: boolean;
}

interface LeaderCardProps {
  leader: Leader;
}

export default function LeaderCard({ leader }: LeaderCardProps) {
  const isPlaceholder = leader.placeholder;

  return (
    <div
      className={`cdn-card cdn-footer-card${isPlaceholder ? ' cdn-footer-placeholder' : ''}`}
      data-leader-id={leader.id}
    >
      <p className="cdn-footer-card-name">{leader.name}</p>

      <Badge color={isPlaceholder ? 'blue' : 'green'}>{leader.role}</Badge>

      {leader.bio && (
        <Box variant="p" color="text-body-secondary">
          <span className="cdn-footer-card-bio">{leader.bio}</span>
        </Box>
      )}

      <div className="cdn-footer-social" role="list" aria-label={`${leader.name} links`}>
        {isPlaceholder ? (
          <PlaceholderCTA meetupUrl={leader.social.meetup} />
        ) : (
          <SocialLinks social={leader.social} name={leader.name} />
        )}
      </div>
    </div>
  );
}

function PlaceholderCTA({ meetupUrl }: { meetupUrl: string | null }) {
  const url = meetupUrl ?? 'https://www.meetup.com/awsugclouddelnorte/';
  return (
    <span role="listitem">
      <Link href={url} external variant="primary" fontSize="body-s">
        Join us on Meetup →
      </Link>
    </span>
  );
}

function SocialLinks({ social, name }: { social: Leader['social']; name: string }) {
  const links: { label: string; href: string }[] = [];

  if (social.github) {
    links.push({ label: 'GitHub', href: `https://github.com/${social.github}` });
  }
  if (social.linkedin) {
    links.push({ label: 'LinkedIn', href: `https://www.linkedin.com/in/${social.linkedin}` });
  }
  if (social.twitter) {
    links.push({ label: 'X', href: `https://x.com/${social.twitter}` });
  }
  if (social.website) {
    links.push({ label: 'Web', href: social.website });
  }
  if (social.meetup) {
    links.push({ label: 'Meetup', href: social.meetup });
  }

  if (links.length === 0) return null;

  return (
    <>
      {links.map(({ label, href }) => (
        <span key={label} role="listitem">
          <Link
            href={href}
            external
            variant="primary"
            fontSize="body-s"
            ariaLabel={`${name} on ${label}`}
          >
            {label}
          </Link>
        </span>
      ))}
    </>
  );
}

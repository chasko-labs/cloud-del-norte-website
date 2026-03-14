// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
import React from 'react';
import Badge from '@cloudscape-design/components/badge';
import Box from '@cloudscape-design/components/box';
import Link from '@cloudscape-design/components/link';
import SpaceBetween from '@cloudscape-design/components/space-between';

import leadersData from '../../data/leaders.json';
import './styles.css';

interface Leader {
  id: string;
  name: string;
  role: string;
  bio: string;
  organization: string | null;
  social: {
    github: string | null;
    linkedin: string | null;
    twitter: string | null;
    website: string | null;
    meetup: string | null;
  };
  placeholder: boolean;
  retired: boolean;
}

const leaders = leadersData as Leader[];

interface LeaderCardProps {
  leader: Leader;
}

function LeaderCard({ leader }: LeaderCardProps) {
  return (
    <div
      data-testid={`leader-card-${leader.id}`}
      className={`cdn-leader-card${leader.placeholder ? ' cdn-leader-card--placeholder' : ''}`}
    >
      <SpaceBetween size="xxs">
        <p className="cdn-leader-card__name">{leader.name}</p>
        <p className="cdn-leader-card__role">{leader.role}</p>
        {leader.placeholder && (
          <Badge color="blue">Open Position</Badge>
        )}
        {leader.bio && (
          <p className="cdn-leader-card__bio">{leader.bio}</p>
        )}
        {leader.organization && (
          <Box color="text-body-secondary" fontSize="body-s">{leader.organization}</Box>
        )}
      </SpaceBetween>
      {leader.placeholder && leader.social.meetup && (
        <div className="cdn-leader-card__cta">
          <Link href={leader.social.meetup} external>
            Join us on Meetup →
          </Link>
        </div>
      )}
      {!leader.placeholder && (
        <div className="cdn-leader-card__cta">
          <SpaceBetween size="xs" direction="horizontal">
            {leader.social.github && (
              <Link href={leader.social.github} external>GitHub</Link>
            )}
            {leader.social.linkedin && (
              <Link href={leader.social.linkedin} external>LinkedIn</Link>
            )}
            {leader.social.meetup && (
              <Link href={leader.social.meetup} external>Meetup</Link>
            )}
          </SpaceBetween>
        </div>
      )}
    </div>
  );
}

export default function Footer() {
  const activeLeaders = leaders.filter((l) => !l.retired);

  return (
    <footer className="cdn-footer">
      <div className="cdn-footer-heading">
        <Box variant="h2">Meet the Squad</Box>
      </div>
      <div className="cdn-footer-grid">
        {activeLeaders.map((leader) => (
          <LeaderCard key={leader.id} leader={leader} />
        ))}
      </div>
    </footer>
  );
}

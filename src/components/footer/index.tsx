import React from 'react';
import Box from '@cloudscape-design/components/box';
import Link from '@cloudscape-design/components/link';
import SpaceBetween from '@cloudscape-design/components/space-between';
import LeaderCard from './leader-card';
import type { Leader } from './leader-card';
import leaders from '../../data/leaders.json';
import './styles.css';

export default function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer id="site-footer" className="cdn-footer" role="contentinfo">
      <SpaceBetween size="l">
        <div>
          <h2 className="cdn-footer-heading">Our Leaders</h2>
          <div className="cdn-footer-grid">
            {(leaders as Leader[]).map((leader) => (
              <LeaderCard key={leader.id} leader={leader} />
            ))}
          </div>
        </div>

        <div className="cdn-footer-bottom">
          <div className="cdn-footer-bottom-links">
            <Link href="/home/index.html" variant="primary" fontSize="body-s">
              Home
            </Link>
            <Link
              href="https://www.meetup.com/cloud-del-norte/"
              external
              variant="primary"
              fontSize="body-s"
            >
              Meetup
            </Link>
          </div>
          <Box variant="small" color="text-body-secondary">
            © {year} AWS User Group Cloud Del Norte. All rights reserved.
          </Box>
        </div>
      </SpaceBetween>
    </footer>
  );
}

import React from 'react';
import Link from '@cloudscape-design/components/link';
import SpaceBetween from '@cloudscape-design/components/space-between';
import LeaderCard from './leader-card';
import type { Leader } from './leader-card';
import leaders from '../../data/leaders.json';
import './styles.css';

export default function Footer() {
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
          <p className="cdn-footer-community">
            AWS User Group Cloud Del Norte is part of AWS User Groups&apos;{' '}
            <Link
              href="https://www.meetup.com/pro/global-aws-user-group-community/"
              external
              variant="primary"
            >
              Global AWS User Group Community
            </Link>
            . We are run by volunteers local to New Mexico, West Texas &amp; Chihuahua, Mexico. We
            believe projects, careers &amp; issues can be accelerated using AWS, &amp; wish to pass
            our knowledge, connections &amp; experiences on to you &amp; see what you{' '}
            <strong className="cdn-footer-emphasis">Go Build</strong>.
          </p>
        </div>
      </SpaceBetween>
    </footer>
  );
}

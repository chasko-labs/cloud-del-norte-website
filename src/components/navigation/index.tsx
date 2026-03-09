// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
import React from 'react';
import SideNavigation, { SideNavigationProps } from '@cloudscape-design/components/side-navigation';

const items: SideNavigationProps['items'] = [
  { type: 'link', text: 'Meetings', href: '/meetings/index.html' },
  { type: 'divider' },
  {
    type: 'section',
    text: 'Resources',
    defaultExpanded: false,
    items: [
      { type: 'link', text: 'Tech Debt Countdowns', href: '/maintenance-calendar/' }
    ]
  },
  { type: 'divider' },
  {
    type: 'section',
    text: 'Learning',
    defaultExpanded: false,
    items: [
      {
        type: 'expandable-link-group',
        text: 'API Guide',
        href: '/learning/api/',
        defaultExpanded: false,
        items: [
          { type: 'link', text: 'REST Overview', href: '/learning/api/#overview' },
          { type: 'link', text: '1️⃣ Uniform Interface', href: '/learning/api/#uniform-interface' },
          { type: 'link', text: '2️⃣ Client-Server', href: '/learning/api/#client-server' },
          { type: 'link', text: '3️⃣ Stateless', href: '/learning/api/#stateless' },
          { type: 'link', text: '4️⃣ Cacheable', href: '/learning/api/#cacheable' },
          { type: 'link', text: '5️⃣ Layered System', href: '/learning/api/#layered-system' },
          { type: 'link', text: '6️⃣ Code on Demand', href: '/learning/api/#code-on-demand' },
          { type: 'link', text: '📋 API Cheat Sheet', href: '/learning/api/#cheat-sheet' },
          { type: 'link', text: '⚙️ How It Works', href: '/learning/api/#how-it-works' },
          { type: 'link', text: '🔗 Project Resources', href: '/learning/api/#resources' }
        ]
      }
    ]
  }
];

export default function Navigation() {
  return (
    <>
      <SideNavigation
        activeHref={location.pathname}
        header={{ href: '/home/index.html', text: 'User Group Home' }}
        items={items}
      />
    </>
  );
}

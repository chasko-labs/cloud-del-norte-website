// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
import React from 'react';
import SideNavigation, { SideNavigationProps } from '@cloudscape-design/components/side-navigation';
import { useTranslation } from '../../hooks/useTranslation';

export default function Navigation() {
  const { t } = useTranslation();

  const items: SideNavigationProps['items'] = [
    { type: 'link', text: t('navigation.meetings'), href: '/meetings/index.html' },
    { type: 'divider' },
    {
      type: 'section',
      text: t('navigation.resources'),
      defaultExpanded: false,
      items: [
        { type: 'link', text: t('navigation.techDebtCountdowns'), href: '/maintenance-calendar/' }
      ]
    },
    { type: 'divider' },
    {
      type: 'section',
      text: t('navigation.learning'),
      defaultExpanded: false,
      items: [
        {
          type: 'expandable-link-group',
          text: t('navigation.apiGuide'),
          href: '/learning/api/',
          defaultExpanded: false,
          items: [
            { type: 'link', text: t('navigation.restOverview'), href: '/learning/api/#overview' },
            { type: 'link', text: t('navigation.uniformInterface'), href: '/learning/api/#uniform-interface' },
            { type: 'link', text: t('navigation.clientServer'), href: '/learning/api/#client-server' },
            { type: 'link', text: t('navigation.stateless'), href: '/learning/api/#stateless' },
            { type: 'link', text: t('navigation.cacheable'), href: '/learning/api/#cacheable' },
            { type: 'link', text: t('navigation.layeredSystem'), href: '/learning/api/#layered-system' },
            { type: 'link', text: t('navigation.codeOnDemand'), href: '/learning/api/#code-on-demand' },
            { type: 'link', text: t('navigation.cheatSheet'), href: '/learning/api/#cheat-sheet' },
            { type: 'link', text: t('navigation.howItWorks'), href: '/learning/api/#how-it-works' },
            { type: 'link', text: t('navigation.projectResources'), href: '/learning/api/#resources' }
          ]
        }
      ]
    }
  ];

  return (
    <>
      <SideNavigation
        activeHref={location.pathname}
        header={{ href: '/home/index.html', text: t('navigation.home') }}
        items={items}
        onFollow={(event) => {
          // Prevent default to avoid React state issues, then navigate manually
          if (!event.detail.external) {
            event.preventDefault();
            window.location.href = event.detail.href;
          }
        }}
      />
    </>
  );
}

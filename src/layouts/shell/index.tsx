// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
import React, { useState, useCallback } from 'react';
import AppLayout, { AppLayoutProps } from '@cloudscape-design/components/app-layout';
import TopNavigation from '@cloudscape-design/components/top-navigation';


import './styles.css';

export interface ShellProps {
  breadcrumbs?: AppLayoutProps['breadcrumbs'];
  contentType?: Extract<AppLayoutProps.ContentType, 'default' | 'table' | 'form'>;
  tools?: AppLayoutProps['tools'];
  children?: AppLayoutProps['content'];
  navigation?: AppLayoutProps['navigation'];
  notifications?: AppLayoutProps['notifications'];
  theme?: 'light' | 'dark';
  onThemeChange?: (theme: 'light' | 'dark') => void;
}

export default function Shell({ children, contentType, breadcrumbs, tools, navigation, notifications, theme, onThemeChange }: ShellProps) {
  const [animating, setAnimating] = useState(false);

  const handleToggleTheme = useCallback(() => {
    onThemeChange?.(theme === 'dark' ? 'light' : 'dark');
    setAnimating(true);
    setTimeout(() => setAnimating(false), 400);
  }, [theme, onThemeChange]);

  return (
    <>
      <div id="top-nav" data-cdn-animating={animating || undefined}>
        <TopNavigation
          identity={{
            /*             logo: { src: '/logo.svg', alt: 'Cloud Del Norte Logo' }, */
            title: 'Cloud Del Norte',
            href: '/home/index.html',
          }}
          utilities={[
            {
              type: 'button',
              text: theme === 'dark' ? '☀️' : '🌙',
              title: theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode',
              onClick: handleToggleTheme,
            }
          ]}
          i18nStrings={{
            overflowMenuTriggerText: 'More',
            overflowMenuTitleText: 'All',
          }}
        />
      </div>
      <AppLayout
        contentType={contentType}
        navigation={navigation}
        breadcrumbs={breadcrumbs}
        notifications={notifications}
        stickyNotifications={true}
        tools={tools}
        content={children}
        headerSelector="#top-nav"
        ariaLabels={{
          navigation: 'Navigation drawer',
          navigationClose: 'Close navigation drawer',
          navigationToggle: 'Open navigation drawer',
          notifications: 'Notifications',
          tools: 'Help panel',
          toolsClose: 'Close help panel',
          toolsToggle: 'Open help panel',
        }}
      />
    </>
  );
}

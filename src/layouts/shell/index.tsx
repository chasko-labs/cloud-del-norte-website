// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
import React, { useState, useCallback } from 'react';
import AppLayout, { AppLayoutProps } from '@cloudscape-design/components/app-layout';
import TopNavigation from '@cloudscape-design/components/top-navigation';
import Footer from '../../components/footer';
import { type Locale } from '../../utils/locale';
import { LocaleProvider } from '../../contexts/locale-context';

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
  locale?: Locale;
  onLocaleChange?: (locale: Locale) => void;
}

export default function Shell({ children, contentType, breadcrumbs, tools, navigation, notifications, theme, onThemeChange, locale, onLocaleChange }: ShellProps) {
  const [animating, setAnimating] = useState(false);
  const [animatingLocale, setAnimatingLocale] = useState(false);

  const handleToggleTheme = useCallback(() => {
    onThemeChange?.(theme === 'dark' ? 'light' : 'dark');
    setAnimating(true);
    setTimeout(() => setAnimating(false), 400);
  }, [theme, onThemeChange]);

  const handleToggleLocale = useCallback(() => {
    onLocaleChange?.(locale === 'mx' ? 'us' : 'mx');
    setAnimatingLocale(true);
    setTimeout(() => setAnimatingLocale(false), 400);
  }, [locale, onLocaleChange]);

  return (
    <LocaleProvider locale={locale ?? 'us'}>
      <div id="top-nav" data-cdn-animating={animating || undefined} data-cdn-animating-locale={animatingLocale || undefined}>
        <TopNavigation
          identity={{
            /*             logo: { src: '/logo.svg', alt: 'Cloud Del Norte Logo' }, */
            title: 'Cloud Del Norte',
            href: '/home/index.html',
          }}
          utilities={[
            {
              type: 'button',
              text: locale === 'mx' ? '🇺🇸' : '🇲🇽',
              title: locale === 'mx' ? 'Switch to English' : 'Cambiar a Español',
              onClick: handleToggleLocale,
            },
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
        footerSelector="#site-footer"
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
      <Footer />
    </LocaleProvider>
  );
}

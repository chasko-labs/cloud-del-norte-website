// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
import React, { useState, useCallback, useEffect } from 'react';
import AppLayout, { AppLayoutProps } from '@cloudscape-design/components/app-layout';
import TopNavigation from '@cloudscape-design/components/top-navigation';
import Footer from '../../components/footer';
import { type Locale } from '../../utils/locale';
import { LocaleProvider } from '../../contexts/locale-context';
import { useTranslation } from '../../hooks/useTranslation';

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
  pageTitle?: string;
}

function ShellContent({ children, contentType, breadcrumbs, tools, navigation, notifications, theme, onThemeChange, locale, onLocaleChange, pageTitle }: ShellProps) {
  const { t } = useTranslation();
  const [animating, setAnimating] = useState(false);
  const [animatingLocale, setAnimatingLocale] = useState(false);

  useEffect(() => {
    document.documentElement.lang = locale === 'mx' ? 'es' : 'en';
    if (pageTitle) {
      document.title = t(pageTitle);
    }
  }, [locale, pageTitle, t]);

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
    <>
      <div id="top-nav" data-cdn-animating={animating || undefined} data-cdn-animating-locale={animatingLocale || undefined}>
        <TopNavigation
          identity={{
            /*             logo: { src: '/logo.svg', alt: 'Cloud Del Norte Logo' }, */
            title: t('shell.siteTitle'),
            href: '/home/index.html',
          }}
          utilities={[
            {
              type: 'button',
              text: locale === 'mx' ? '🇺🇸' : '🇲🇽',
              title: locale === 'mx' ? t('shell.switchToUs') : t('shell.switchToMx'),
              onClick: handleToggleLocale,
            },
            {
              type: 'button',
              text: theme === 'dark' ? '☀️' : '🌙',
              title: theme === 'dark' ? t('shell.switchToLightMode') : t('shell.switchToDarkMode'),
              onClick: handleToggleTheme,
            }
          ]}
          i18nStrings={{
            overflowMenuTriggerText: t('shell.more'),
            overflowMenuTitleText: t('shell.all'),
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
          navigation: t('shell.navigationDrawer'),
          navigationClose: t('shell.closeNavigationDrawer'),
          navigationToggle: t('shell.openNavigationDrawer'),
          notifications: t('shell.notifications'),
          tools: t('shell.helpPanel'),
          toolsClose: t('shell.closeHelpPanel'),
          toolsToggle: t('shell.openHelpPanel'),
        }}
      />
      <Footer />
    </>
  );
}

export default function Shell(props: ShellProps) {
  return (
    <LocaleProvider locale={props.locale ?? 'us'}>
      <ShellContent {...props} />
    </LocaleProvider>
  );
}

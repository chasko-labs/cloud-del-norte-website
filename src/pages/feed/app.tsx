// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
import React, { useState } from 'react';
import ContentLayout from '@cloudscape-design/components/content-layout';
import Grid from '@cloudscape-design/components/grid';
import Header from '@cloudscape-design/components/header';
import Link from '@cloudscape-design/components/link';
import Navigation from '../../components/navigation';
import Breadcrumbs from '../../components/breadcrumbs';
import Shell from '../../layouts/shell';
import { HelpPanelHome } from '../create-meeting/components/help-panel-home';
import { initializeTheme, applyTheme, setStoredTheme, type Theme } from '../../utils/theme';
import { initializeLocale, applyLocale, setStoredLocale, type Locale } from '../../utils/locale';
import { useTranslation } from '../../hooks/useTranslation';
import YoutubeCarousel from './components/youtube-carousel';
import TwitchSection from './components/twitch-section';
import FeedSection from './components/feed-section';
import BuilderCenterCard from './components/builder-center-card';
import './styles.css';

function AppContent({
  theme,
  onThemeChange,
  locale,
  onLocaleChange,
}: {
  theme: Theme;
  onThemeChange: (t: Theme) => void;
  locale: Locale;
  onLocaleChange: (l: Locale) => void;
}) {
  const { t } = useTranslation();

  return (
    <ContentLayout
      header={
        <Header variant="h1" info={<Link variant="info">{t('feedPage.infoLink')}</Link>}>
          {t('feedPage.header')}
        </Header>
      }
    >
      <Grid gridDefinition={[{ colspan: 12 }, { colspan: 12 }, { colspan: 12 }, { colspan: 12 }]}>
        <BuilderCenterCard />
        <YoutubeCarousel />
        <TwitchSection />
        <FeedSection />
      </Grid>
    </ContentLayout>
  );
}

function BreadcrumbsContent() {
  const { t } = useTranslation();
  return <Breadcrumbs active={{ text: t('feedPage.breadcrumb'), href: '/feed/index.html' }} />;
}

export default function App() {
  const [theme, setTheme] = useState<Theme>(() => initializeTheme());
  const [locale, setLocale] = useState<Locale>(() => initializeLocale());

  const handleThemeChange = (newTheme: Theme) => {
    setTheme(newTheme);
    applyTheme(newTheme);
    setStoredTheme(newTheme);
  };

  const handleLocaleChange = (newLocale: Locale) => {
    setLocale(newLocale);
    applyLocale(newLocale);
    setStoredLocale(newLocale);
  };

  return (
    <Shell
      theme={theme}
      onThemeChange={handleThemeChange}
      locale={locale}
      onLocaleChange={handleLocaleChange}
      breadcrumbs={<BreadcrumbsContent />}
      navigation={<Navigation />}
      tools={<HelpPanelHome />}
    >
      <AppContent theme={theme} onThemeChange={handleThemeChange} locale={locale} onLocaleChange={handleLocaleChange} />
    </Shell>
  );
}

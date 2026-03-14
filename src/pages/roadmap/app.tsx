// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
import React, { useState, useEffect } from 'react';
import ContentLayout from '@cloudscape-design/components/content-layout';
import Header from '@cloudscape-design/components/header';
import Navigation from '../../components/navigation';
import Breadcrumbs from '../../components/breadcrumbs';
import Shell from '../../layouts/shell';
import { initializeTheme, applyTheme, setStoredTheme, type Theme } from '../../utils/theme';
import { initializeLocale, applyLocale, setStoredLocale, type Locale } from '../../utils/locale';
import { useTranslation } from '../../hooks/useTranslation';
import { boardColumns } from './data';
import './styles.css';

function AppContent() {
  const { t } = useTranslation();

  useEffect(() => {
    document.title = `${t('roadmap.title')} — AWS UG Cloud Del Norte`;
  }, [t]);

  return (
    <ContentLayout
      header={
        <Header variant="h1">
          {t('roadmap.title')}
        </Header>
      }
    >
      <div className="cdn-roadmap-board">
        {boardColumns.map((column) => (
          <div key={column.key} className="cdn-roadmap-column" data-column={column.key}>
            <div className="cdn-roadmap-column-header">
              {t(column.translationKey)}
            </div>
            {column.cards.map((card) => (
              <div key={card.id} className="cdn-roadmap-card">
                {card.id}
              </div>
            ))}
          </div>
        ))}
      </div>
    </ContentLayout>
  );
}

function BreadcrumbsContent() {
  const { t } = useTranslation();
  return <Breadcrumbs active={{ text: t('roadmap.breadcrumb'), href: '/roadmap/index.html' }} />;
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
    >
      <AppContent />
    </Shell>
  );
}

// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
import React, { useState } from 'react';
import { HelpPanelHome } from '../create-meeting/components/help-panel-home';

import Breadcrumbs from '../../components/breadcrumbs';
import Navigation from '../../components/navigation';
import ShellLayout from '../../layouts/shell';
import VariationsTable from './components/meetings-table';

import { variationsData } from './data';
import { initializeTheme, applyTheme, setStoredTheme, type Theme } from '../../utils/theme';
import { initializeLocale, applyLocale, setStoredLocale, type Locale } from '../../utils/locale';
import { useTranslation } from '../../hooks/useTranslation';

export default function App() {
  const { t } = useTranslation();
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
    <ShellLayout
      contentType="table"
      theme={theme}
      onThemeChange={handleThemeChange}
      locale={locale}
      onLocaleChange={handleLocaleChange}
      breadcrumbs={<Breadcrumbs active={{ text: t('meetings.breadcrumb'), href: '/meetings/index.html' }} />}
      navigation={<Navigation />}
      tools={<HelpPanelHome />}
    >
      <VariationsTable meetings={variationsData} />
    </ShellLayout>
  );
}

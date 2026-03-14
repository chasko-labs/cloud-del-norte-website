import React, { useState } from 'react';
import Shell from '../../../layouts/shell';
import Navigation from '../../../components/navigation';
import Breadcrumbs from '../../../components/breadcrumbs';
import { initializeTheme, applyTheme, setStoredTheme, type Theme } from '../../../utils/theme';
import { initializeLocale, applyLocale, setStoredLocale, type Locale } from '../../../utils/locale';
import { useTranslation } from '../../../hooks/useTranslation';
import RiftRewindDashboard from './RiftRewindDashboard';

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
    <Shell
      theme={theme}
      onThemeChange={handleThemeChange}
      locale={locale}
      onLocaleChange={handleLocaleChange}
      breadcrumbs={
        <Breadcrumbs
          active={{ text: t('navigation.apiGuide'), href: '/learning/api/index.html' }}
        />
      }
      navigation={<Navigation />}
    >
      <RiftRewindDashboard />
    </Shell>
  );
}

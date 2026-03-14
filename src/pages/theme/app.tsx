// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
import React, { useState, useEffect } from 'react';
import ContentLayout from '@cloudscape-design/components/content-layout';
import Header from '@cloudscape-design/components/header';
import SpaceBetween from '@cloudscape-design/components/space-between';
import Box from '@cloudscape-design/components/box';
import Container from '@cloudscape-design/components/container';
import Grid from '@cloudscape-design/components/grid';
import ColumnLayout from '@cloudscape-design/components/column-layout';
import Navigation from '../../components/navigation';
import Breadcrumbs from '../../components/breadcrumbs';
import Shell from '../../layouts/shell';
import { initializeTheme, applyTheme, setStoredTheme, type Theme } from '../../utils/theme';
import { initializeLocale, applyLocale, setStoredLocale, type Locale } from '../../utils/locale';
import { useTranslation } from '../../hooks/useTranslation';
import { LocaleProvider } from '../../contexts/locale-context';
import {
  brandColors,
  textEmphasisLevels,
  elevationLevels,
  shadowTokens,
  typographyScale
} from './data';

function AppContent({ theme, onThemeChange, locale, onLocaleChange }: { theme: Theme; onThemeChange: (t: Theme) => void; locale: Locale; onLocaleChange: (l: Locale) => void }) {
  const { t } = useTranslation();

  useEffect(() => {
    document.title = t('themePage.pageTitle');
  }, [t]);

  return (
    <ContentLayout
      header={
        <Header variant="h1">
          {t('themePage.header')}
        </Header>
      }
    >
      <SpaceBetween size="l">
        {/* Brand Colors Section */}
        <Container header={<Header variant="h2">{t('themePage.sections.brandColors')}</Header>}>
          <SpaceBetween size="m">
            <Box variant="p">{t('themePage.sections.brandColorsDescription')}</Box>
            <Grid
              gridDefinition={[
                { colspan: { default: 12, xs: 6, s: 4, m: 3 } },
                { colspan: { default: 12, xs: 6, s: 4, m: 3 } },
                { colspan: { default: 12, xs: 6, s: 4, m: 3 } },
                { colspan: { default: 12, xs: 6, s: 4, m: 3 } },
                { colspan: { default: 12, xs: 6, s: 4, m: 3 } },
                { colspan: { default: 12, xs: 6, s: 4, m: 3 } },
                { colspan: { default: 12, xs: 6, s: 4, m: 3 } }
              ]}
            >
              {brandColors.map((color) => (
                <Box key={color.variable} padding="s">
                  <SpaceBetween size="xs">
                    <div
                      style={{
                        backgroundColor: color.hex,
                        height: '80px',
                        borderRadius: '8px',
                        border: '1px solid var(--cdn-color-border)'
                      }}
                    />
                    <Box variant="strong" fontSize="body-s">
                      {t(color.name)}
                    </Box>
                    <Box variant="code" fontSize="body-s">
                      {color.variable}
                    </Box>
                    <Box variant="small" color="text-body-secondary">
                      {color.hex}
                    </Box>
                    <Box variant="p" fontSize="body-s">
                      {t(color.description)}
                    </Box>
                  </SpaceBetween>
                </Box>
              ))}
            </Grid>
          </SpaceBetween>
        </Container>

        {/* Text Emphasis Section */}
        <Container header={<Header variant="h2">{t('themePage.sections.textEmphasis')}</Header>}>
          <SpaceBetween size="m">
            <Box variant="p">{t('themePage.sections.textEmphasisDescription')}</Box>
            <ColumnLayout columns={3} variant="text-grid">
              {textEmphasisLevels.map((level) => (
                <Box key={level.variable} padding="s">
                  <SpaceBetween size="xs">
                    <Box variant="strong" fontSize="heading-m">
                      {t(level.name)}
                    </Box>
                    <Box variant="code" fontSize="body-s">
                      {level.variable}
                    </Box>
                    <Box variant="small" color="text-body-secondary">
                      {level.hex}
                    </Box>
                    <Box variant="p" fontSize="body-s">
                      {t(level.description)}
                    </Box>
                  </SpaceBetween>
                </Box>
              ))}
            </ColumnLayout>
          </SpaceBetween>
        </Container>

        {/* Elevation Levels (Dark Mode Only) */}
        <Container header={<Header variant="h2">{t('themePage.sections.elevation')}</Header>}>
          <SpaceBetween size="m">
            <Box variant="p">{t('themePage.sections.elevationDescription')}</Box>
            <ColumnLayout columns={4} variant="text-grid">
              {elevationLevels.map((elevation) => (
                <Box key={elevation.variable} padding="s">
                  <SpaceBetween size="xs">
                    <div
                      style={{
                        backgroundColor: elevation.hex,
                        height: '80px',
                        borderRadius: '8px',
                        border: '1px solid var(--cdn-color-border)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'var(--cdn-color-text-high)'
                      }}
                    >
                      <Box variant="strong">{`${t('themePage.elevation.level')} ${elevation.level}`}</Box>
                    </div>
                    <Box variant="code" fontSize="body-s">
                      {elevation.variable}
                    </Box>
                    <Box variant="small" color="text-body-secondary">
                      {elevation.hex}
                    </Box>
                    <Box variant="p" fontSize="body-s">
                      {t(elevation.usage)}
                    </Box>
                  </SpaceBetween>
                </Box>
              ))}
            </ColumnLayout>
          </SpaceBetween>
        </Container>

        {/* Shadow Tokens Section */}
        <Container header={<Header variant="h2">{t('themePage.sections.shadows')}</Header>}>
          <SpaceBetween size="m">
            <Box variant="p">{t('themePage.sections.shadowsDescription')}</Box>
            <Grid
              gridDefinition={[
                { colspan: { default: 12, s: 4 } },
                { colspan: { default: 12, s: 4 } },
                { colspan: { default: 12, s: 4 } }
              ]}
            >
              {shadowTokens.map((shadow) => (
                <Box key={shadow.variable} padding="s">
                  <SpaceBetween size="xs">
                    <div
                      style={{
                        backgroundColor: 'var(--cdn-color-surface)',
                        height: '100px',
                        borderRadius: '8px',
                        boxShadow: `var(${shadow.variable})`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}
                    >
                      <Box variant="strong">{t(shadow.name)}</Box>
                    </div>
                    <Box variant="code" fontSize="body-s">
                      {shadow.variable}
                    </Box>
                    <Box variant="p" fontSize="body-s">
                      {t(shadow.usage)}
                    </Box>
                  </SpaceBetween>
                </Box>
              ))}
            </Grid>
          </SpaceBetween>
        </Container>

        {/* Typography Scale Section */}
        <Container header={<Header variant="h2">{t('themePage.sections.typography')}</Header>}>
          <SpaceBetween size="m">
            <Box variant="p">{t('themePage.sections.typographyDescription')}</Box>
            <SpaceBetween size="s">
              {typographyScale.map((type) => (
                <Box key={type.variable} padding="s">
                  <ColumnLayout columns={3} variant="text-grid">
                    <div>
                      <Box
                        variant="strong"
                        fontSize={
                          type.variable === '--cdn-text-sm'
                            ? 'body-s'
                            : type.variable === '--cdn-text-base'
                            ? 'body-m'
                            : type.variable === '--cdn-text-lg'
                            ? 'heading-s'
                            : type.variable === '--cdn-text-xl'
                            ? 'heading-m'
                            : 'heading-l'
                        }
                      >
                        {t(type.name)}
                      </Box>
                    </div>
                    <div>
                      <SpaceBetween size="xxs">
                        <Box variant="code" fontSize="body-s">
                          {type.variable}
                        </Box>
                        <Box variant="small" color="text-body-secondary">
                          {type.size}
                        </Box>
                      </SpaceBetween>
                    </div>
                    <Box variant="p" fontSize="body-s">
                      {t(type.usage)}
                    </Box>
                  </ColumnLayout>
                </Box>
              ))}
            </SpaceBetween>
          </SpaceBetween>
        </Container>

        {/* Glassmorphism Card Sample */}
        <Container header={<Header variant="h2">{t('themePage.sections.cardExample')}</Header>}>
          <SpaceBetween size="m">
            <Box variant="p">{t('themePage.sections.cardExampleDescription')}</Box>
            <div className="cdn-card" style={{ padding: '24px' }}>
              <SpaceBetween size="s">
                <Box variant="h3" fontSize="heading-m">
                  {t('themePage.cardExample.title')}
                </Box>
                <Box variant="p">
                  {t('themePage.cardExample.description')}
                </Box>
                <Box variant="small" color="text-body-secondary">
                  {t('themePage.cardExample.technicalNote')}
                </Box>
              </SpaceBetween>
            </div>
          </SpaceBetween>
        </Container>
      </SpaceBetween>
    </ContentLayout>
  );
}

function BreadcrumbsContent() {
  const { t } = useTranslation();
  return <Breadcrumbs active={{ text: t('themePage.breadcrumb'), href: '/theme/index.html' }} />;
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
    <LocaleProvider locale={locale}>
      <Shell
        theme={theme}
        onThemeChange={handleThemeChange}
        locale={locale}
        onLocaleChange={handleLocaleChange}
        breadcrumbs={<BreadcrumbsContent />}
        navigation={<Navigation />}
      >
        <AppContent theme={theme} onThemeChange={handleThemeChange} locale={locale} onLocaleChange={handleLocaleChange} />
      </Shell>
    </LocaleProvider>
  );
}

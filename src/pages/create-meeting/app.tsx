// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
import React, { useState } from 'react';

import Button from '@cloudscape-design/components/button';
import Form from '@cloudscape-design/components/form';
import Header from '@cloudscape-design/components/header';
import HelpPanel from '@cloudscape-design/components/help-panel';
import SpaceBetween from '@cloudscape-design/components/space-between';
import Breadcrumbs from '../../components/breadcrumbs';
import MeetingDetails from './components/marketing';
import Navigation from '../../components/navigation';
import Shape from './components/shape';
import ShellLayout from '../../layouts/shell';
import { BasicValidationContext, useBasicValidation } from './validation/basic-validation';
import { ContentLayout } from '@cloudscape-design/components';
import { initializeTheme, applyTheme, setStoredTheme, type Theme } from '../../utils/theme';
import { initializeLocale, applyLocale, setStoredLocale, type Locale } from '../../utils/locale';
import { useTranslation } from '../../hooks/useTranslation';

export default function App() {
  const { t } = useTranslation();
  const { isFormSubmitted, setIsFormSubmitted, addErrorField, focusFirstErrorField } = useBasicValidation();
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
      contentType="form"
      theme={theme}
      onThemeChange={handleThemeChange}
      locale={locale}
      onLocaleChange={handleLocaleChange}
      breadcrumbs={<Breadcrumbs active={{ text: t('createMeeting.breadcrumb'), href: '/create-meeting/index.html' }} />}
      navigation={<Navigation />}
      tools={<HelpPanel header={<h2>{t('createMeeting.helpPanelHeader')}</h2>} />}
    >
      <ContentLayout
        header={
          <Header
            variant="h1"
            description={t('createMeeting.description')}
          >
            {t('createMeeting.header')}
          </Header>
        }
      >
        <SpaceBetween size="m">
          <BasicValidationContext.Provider value={{ isFormSubmitted: isFormSubmitted, addErrorField: addErrorField }}>
            <form
              onSubmit={event => {
                setIsFormSubmitted(true);
                focusFirstErrorField();
                event.preventDefault();
              }}
            >
              <Form
                actions={
                  <SpaceBetween direction="horizontal" size="xs">
                    <Button href="/meetings/index.html" variant="link">
                      {t('common.cancel')}
                    </Button>
                    <Button formAction="submit" variant="primary">
                      {t('createMeeting.submit')}
                    </Button>
                  </SpaceBetween>
                }
              >
                <SpaceBetween size="l">
                  <Shape />
                  <details />
                  <MeetingDetails />
                </SpaceBetween>
              </Form>
            </form>
          </BasicValidationContext.Provider>
        </SpaceBetween>
      </ContentLayout>
    </ShellLayout>
  );
}

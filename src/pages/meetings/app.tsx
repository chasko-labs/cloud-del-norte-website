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

export default function App() {
  const [theme, setTheme] = useState<Theme>(() => initializeTheme());

  const handleThemeChange = (newTheme: Theme) => {
    setTheme(newTheme);
    applyTheme(newTheme);
    setStoredTheme(newTheme);
  };

  return (
    <ShellLayout
      contentType="table"
      theme={theme}
      onThemeChange={handleThemeChange}
      breadcrumbs={<Breadcrumbs active={{ text: 'Meetings', href: '/meetings/index.html' }} />}
      navigation={<Navigation />}
      tools={<HelpPanelHome />}
    >
      <VariationsTable meetings={variationsData} />
    </ShellLayout>
  );
}

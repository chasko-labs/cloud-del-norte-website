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
import ProductionOverview from './components/production-overview';
import Meetings from './components/meetings';
import QualityReport from './components/quality-report';
import { HelpPanelHome } from '../create-meeting/components/help-panel-home';
import { variationData, breakdownItems, productionMetrics, quote, notes } from './data';
import { initializeTheme, applyTheme, setStoredTheme, type Theme } from '../../utils/theme';

export default function App() {
  const [theme, setTheme] = useState<Theme>(() => initializeTheme());

  const handleThemeChange = (newTheme: Theme) => {
    setTheme(newTheme);
    applyTheme(newTheme);
    setStoredTheme(newTheme);
  };

  return (
    <Shell
      theme={theme}
      onThemeChange={handleThemeChange}
      breadcrumbs={<Breadcrumbs active={{ text: 'Dashboard', href: '/home/index.html' }} />}
      navigation={<Navigation />}
      tools={<HelpPanelHome />}
    >
      <ContentLayout
        header={
          <Header variant="h1" info={<Link variant="info">Info</Link>}>
            Dashboard
          </Header>
        }
      >
        <Grid gridDefinition={[{ colspan: 12 }, { colspan: 8 }, { colspan: 4 }]} disableGutters={false}>
          <ProductionOverview metrics={productionMetrics} />
          <Meetings data={variationData} items={breakdownItems} />
          <QualityReport quote={quote} notes={notes} />
        </Grid>
      </ContentLayout>
    </Shell>
  );
}

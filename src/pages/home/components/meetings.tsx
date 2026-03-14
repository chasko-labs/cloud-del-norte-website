// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
import React from 'react';
import Container from '@cloudscape-design/components/container';
import Header from '@cloudscape-design/components/header';
import PieChart, { PieChartProps } from '@cloudscape-design/components/pie-chart';
import StatusIndicator from '@cloudscape-design/components/status-indicator';
import Table, { TableProps } from '@cloudscape-design/components/table';
import SpaceBetween from '@cloudscape-design/components/space-between';
import { useTranslation } from '../../../hooks/useTranslation';

const columnDefinitions = (t: (key: string) => string): TableProps['columnDefinitions'] => [
  { header: t('productionTable.headers.name'), cell: ({ name }) => t(name) },
  {
    header: t('productionTable.headers.status'),
    cell: ({ status }) => <StatusIndicator type={status.type}>{status.message}</StatusIndicator>,
  },
  { header: t('productionTable.headers.mixing'), cell: ({ mixing }) => mixing },
  { header: t('productionTable.headers.molding'), cell: ({ molding }) => molding },
];

export interface VariationsProps {
  data: PieChartProps['data'];
  items: TableProps['items'];
}

export default function meetings({ data, items }: VariationsProps) {
  const { t } = useTranslation();
  const translatedData = data.map((item) => ({ ...item, title: t(item.title) }));
  
  return (
    <div className="cdn-card">
      <SpaceBetween size={'l'}>
        <Container header={<Header variant="h2">{t('dashboardPage.pastTopics.header')}</Header>}>
          <PieChart data={translatedData} hideFilter={true} i18nStrings={{
            chartAriaRoleDescription: t('pieChart.chartAriaRoleDescription'),
            detailPopoverDismissAriaLabel: t('pieChart.detailPopoverDismissAriaLabel'),
            legendAriaLabel: t('pieChart.legendAriaLabel'),
            filterSelectedAriaLabel: t('pieChart.filterSelectedAriaLabel'),
            segmentAriaRoleDescription: t('pieChart.segmentAriaRoleDescription'),
          }} />
        </Container>
        {/*       <Table
        sortingColumn={columnDefinitions[0]}
        enableKeyboardNavigation={true}
        header={<Header variant="h2">Details</Header>}
        items={items}
        columnDefinitions={columnDefinitions}
        ariaLabels={{
          tableLabel: 'Details table',
        }}
      />
      */}
      </SpaceBetween>
    </div>
  );
}

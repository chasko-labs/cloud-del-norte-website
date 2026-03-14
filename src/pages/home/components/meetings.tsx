// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
import React from 'react';
import Container from '@cloudscape-design/components/container';
import Header from '@cloudscape-design/components/header';
import PieChart, { PieChartProps } from '@cloudscape-design/components/pie-chart';
import StatusIndicator from '@cloudscape-design/components/status-indicator';
import Table, { TableProps } from '@cloudscape-design/components/table';
import { SpaceBetween } from '@cloudscape-design/components';
import { useTranslation } from '../../../hooks/useTranslation';

const columnDefinitions = (t: (key: string) => string): TableProps['columnDefinitions'] => [
  { header: t('home.tableHeaders.name'), cell: ({ name }) => name },
  {
    header: t('home.tableHeaders.status'),
    cell: ({ status }) => <StatusIndicator type={status.type}>{status.message}</StatusIndicator>,
  },
  { header: t('home.tableHeaders.mixing'), cell: ({ mixing }) => mixing },
  { header: t('home.tableHeaders.molding'), cell: ({ molding }) => molding },
];

export interface VariationsProps {
  data: PieChartProps['data'];
  items: TableProps['items'];
}

export default function meetings({ data, items }: VariationsProps) {
  const { t } = useTranslation();
  
  return (
    <div className="cdn-card">
      <SpaceBetween size={'l'}>
        <Container header={<Header variant="h2">{t('home.pastTopicsHeader')}</Header>}>
          <PieChart data={data} hideFilter={true} i18nStrings={{
            chartAriaRoleDescription: 'Pie chart',
            detailPopoverDismissAriaLabel: 'Dismiss',
            legendAriaLabel: 'Legend',
            filterSelectedAriaLabel: 'filterSelectedAriaLabel',
            segmentAriaRoleDescription: 'segment',
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
 */}    </SpaceBetween>
    </div>
  );
}

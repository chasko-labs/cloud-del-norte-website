// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
import React, { ReactNode, useState } from 'react';

import { useCollection } from '@cloudscape-design/collection-hooks';
import CollectionPreferences, {
  CollectionPreferencesProps,
} from '@cloudscape-design/components/collection-preferences';
import Header from '@cloudscape-design/components/header';
import Pagination from '@cloudscape-design/components/pagination';
import Table, { TableProps } from '@cloudscape-design/components/table';

import { meeting } from '../data';
import TextFilter from '@cloudscape-design/components/text-filter';
import Box from '@cloudscape-design/components/box';
import Button from '@cloudscape-design/components/button';
import SpaceBetween from '@cloudscape-design/components/space-between';
import { useTranslation } from '../../../hooks/useTranslation';

const getFilterCounterText = (count = 0, t: (key: string) => string) => `${count} ${count === 1 ? t('meetings.filterCounter.match') : t('meetings.filterCounter.matches')}`;
const getHeaderCounterText = (items: readonly meeting[] = [], selectedItems: readonly meeting[] = []) => {
  return selectedItems && selectedItems.length > 0 ? `(${selectedItems.length}/${items.length})` : `(${items.length})`;
};

const columnDefinitions = (t: (key: string) => string): TableProps<meeting>['columnDefinitions'] => [
  {
    header: t('meetings.tableHeaders.meetupTitle'),
    cell: ({ name }) => name,
    sortingField: 'name',
    minWidth: 175,
  },
  {
    header: t('meetings.tableHeaders.presenters'),
    cell: ({ presenters }) => presenters,
    sortingField: 'presenters',
    minWidth: 160,
  },
  {
    header: t('meetings.tableHeaders.happened'),
    cell: ({ happened }) => happened,
    sortingField: 'happened',
    minWidth: 90,
  },
  {
    header: t('meetings.tableHeaders.onDemand'),
    cell: ({ ondemand }) => ondemand,
    sortingField: 'ondemand',
    minWidth: 140,
  },
  {
    header: t('meetings.tableHeaders.eventPage'),
    cell: ({ eventlink }) => eventlink,
    sortingField: 'eventlink',
    minWidth: 160,
  }
];

const EmptyState = ({ title, subtitle, action }: { title: string; subtitle: string; action: ReactNode }) => {
  return (
    <Box textAlign="center" color="inherit">
      <Box variant="strong" textAlign="center" color="inherit">
        {title}
      </Box>
      <Box variant="p" padding={{ bottom: 's' }} color="inherit">
        {subtitle}
      </Box>
      {action}
    </Box>
  );
};

export interface VariationTableProps {
  meetings: meeting[];
}

export default function VariationTable({ meetings }: VariationTableProps) {
  const { t } = useTranslation();
  const [preferences, setPreferences] = useState<CollectionPreferencesProps['preferences']>({ pageSize: 20 });
  const { items, filterProps, actions, filteredItemsCount, paginationProps, collectionProps } = useCollection<meeting>(
    meetings,
    {
      filtering: {
        noMatch: (
          <EmptyState
            title={t('meetings.empty.noMatches')}
            subtitle={t('meetings.empty.noMatchesSubtitle')}
            action={<Button onClick={() => actions.setFiltering('')}>{ }{t('meetings.empty.clearFilter')}</Button>}
          />
        ),
        empty: (
          <EmptyState title={t('meetings.empty.noMeetings')} subtitle={t('meetings.empty.noMeetingsSubtitle')} action={<Button>{t('meetings.createButton')}</Button>} />
        ),
      },
      pagination: { pageSize: preferences?.pageSize },
      sorting: { defaultState: { sortingColumn: columnDefinitions(t)[0] } },
      selection: {},
    }
  );

  return (
    <Table<meeting>
      {...collectionProps}
      enableKeyboardNavigation={false}
      items={items}
      columnDefinitions={columnDefinitions(t)}
      stickyHeader={true}
      resizableColumns={true}
      variant="full-page"
      //selectionType="single"
      ariaLabels={{
        selectionGroupLabel: t('meetings.aria.selectionGroup'),
        itemSelectionLabel: ({ selectedItems }, item) => {
          const isItemSelected = selectedItems.filter(i => i.name === item.name).length;
          return `${item.name} is ${isItemSelected ? '' : 'not '}selected`;
        },
        tableLabel: t('meetings.aria.tableLabel'),
      }}
      header={
        <Header
          variant="awsui-h1-sticky"
          counter={getHeaderCounterText(meetings, collectionProps.selectedItems)}
          actions={
            <SpaceBetween size="xs" direction="horizontal">
              <Button disabled={collectionProps.selectedItems?.length === 0}>{t('meetings.editButton')}</Button>
              <Button disabled={collectionProps.selectedItems?.length === 0} href="/create-meeting/index.html" variant="primary">
                {t('meetings.createButton')}
              </Button>
            </SpaceBetween>
          }
        >
          {t('meetings.header')}
        </Header>
      }
      pagination={<Pagination {...paginationProps} />}
      filter={
        <TextFilter
          {...filterProps}
          filteringPlaceholder={t('meetings.findPlaceholder')}
          countText={getFilterCounterText(filteredItemsCount, t)}
        />
      }
      preferences={
        <CollectionPreferences
          preferences={preferences}
          pageSizePreference={{
            title: t('meetings.preferences.pageSize'),
            options: [
              { value: 10, label: t('meetings.preferences.resources10') },
              { value: 20, label: t('meetings.preferences.resources20') },
              { value: 50, label: t('meetings.preferences.resources50') },
              { value: 100, label: t('meetings.preferences.resources100') },
            ],
          }}
          onConfirm={({ detail }) => setPreferences(detail)}
          title={t('meetings.preferences.title')}
          confirmLabel={t('meetings.preferences.confirm')}
          cancelLabel={t('meetings.preferences.cancel')}
        />
      }
    />
  );
}

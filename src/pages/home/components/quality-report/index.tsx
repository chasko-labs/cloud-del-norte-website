// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
import React, { useState } from 'react';
import Box from '@cloudscape-design/components/box';
import Button from '@cloudscape-design/components/button';
import Container from '@cloudscape-design/components/container';
import Header from '@cloudscape-design/components/header';
import Modal from '@cloudscape-design/components/modal';
import Table, { TableProps } from '@cloudscape-design/components/table';
import { useTranslation } from '../../../../hooks/useTranslation';

const columnDefinitions = (t: (key: string) => string): TableProps['columnDefinitions'] => [
  { header: t('home.tableHeaders.name'), cell: ({ name }) => name },
  { header: t('home.tableHeaders.strong'), cell: ({ strong }) => strong },
  { header: t('home.tableHeaders.mild'), cell: ({ mild }) => mild },
  { header: t('home.tableHeaders.unnoticed'), cell: ({ unnoticed }) => unnoticed },
];

export interface QualityReportProps {
  quote: string;
  notes: TableProps['items'];
}

export default function QualityReport({ quote, notes }: QualityReportProps) {
  const { t } = useTranslation();
  const [showTastingNotes, setShowTastingNotes] = useState(false);

  return (
    <div className="cdn-card">
      <Container header={<Header variant="h2">{t('home.userGroupHeader')}</Header>}>
        <Box color="text-body-secondary">{quote}</Box>
        {/* <Button variant="normal" onClick={() => setShowTastingNotes(true)}>
        About Services Discussed
      </Button> */}
        {showTastingNotes ? (
          <Modal visible={true} onDismiss={() => setShowTastingNotes(false)} header={t('home.groupNotesModal')}>
            <Table
              sortingColumn={columnDefinitions(t)[0]}
              enableKeyboardNavigation={true}
              items={notes}
              columnDefinitions={columnDefinitions(t)}
            />
          </Modal>
        ) : null}
      </Container>
    </div>
  );
}

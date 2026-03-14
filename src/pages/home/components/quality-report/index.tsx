// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
import React, { useState } from 'react';
import Box from '@cloudscape-design/components/box';
import Button from '@cloudscape-design/components/button';
import Container from '@cloudscape-design/components/container';
import Header from '@cloudscape-design/components/header';
import Modal from '@cloudscape-design/components/modal';
import SpaceBetween from '@cloudscape-design/components/space-between';
import Table, { TableProps } from '@cloudscape-design/components/table';
import { useTranslation } from '../../../../hooks/useTranslation';
import './styles.css';

const columnDefinitions = (t: (key: string) => string): TableProps['columnDefinitions'] => [
  { header: t('qualityTable.headers.name'), cell: ({ name }) => t(name) },
  { header: t('qualityTable.headers.strong'), cell: ({ strong }) => strong },
  { header: t('qualityTable.headers.mild'), cell: ({ mild }) => mild },
  { header: t('qualityTable.headers.unnoticed'), cell: ({ unnoticed }) => unnoticed },
];

export interface QualityReportProps {
  notes: TableProps['items'];
}

export default function QualityReport({ notes }: QualityReportProps) {
  const { t } = useTranslation();
  const [showTastingNotes, setShowTastingNotes] = useState(false);

  return (
    <div className="cdn-card">
      <Container header={<Header variant="h2">{t('userGroupHero.header')}</Header>}>
        <SpaceBetween size="m">
          <Box color="text-body-secondary" padding={{ top: 'xs', bottom: 'xs' }}>
            <p className="quote">{t('userGroupHero.description')}</p>
          </Box>
        </SpaceBetween>
        {/* <Button variant="normal" onClick={() => setShowTastingNotes(true)}>
        About Services Discussed
      </Button> */}
        {showTastingNotes ? (
          <Modal visible={true} onDismiss={() => setShowTastingNotes(false)} header={t('dashboardPage.groupNotesModal')}>
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

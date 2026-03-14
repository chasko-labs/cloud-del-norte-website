// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
import React from 'react';
import { useState } from 'react';
import Container from '@cloudscape-design/components/container';
import FormField from '@cloudscape-design/components/form-field';
import Header from '@cloudscape-design/components/header';
import Tiles from '@cloudscape-design/components/tiles';
import { useTranslation } from '../../../hooks/useTranslation';

export default function Shape() {
  const { t } = useTranslation();
  const [shape, setShape] = useState('bar');

  return (
    <Container header={<Header variant="h2">{t('createMeeting.meetingType.header')}</Header>}>
      <FormField label={t('createMeeting.meetingType.shapeLabel')} stretch={true}>
        <Tiles
          items={[
            {
              value: 'virtual',
              label: t('createMeeting.meetingType.virtual'),
              description: t('createMeeting.meetingType.virtualDescription'),
            },
            {
              value: 'inperson',
              label: t('createMeeting.meetingType.inPerson'),
              description: t('createMeeting.meetingType.inPersonDescription'),
            },
          ]}
          value={shape}
          onChange={e => setShape(e.detail.value)}
        />
      </FormField>
    </Container>
  );
}

// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
import React from 'react';
import ColumnLayout from '@cloudscape-design/components/column-layout';
import Container from '@cloudscape-design/components/container';
import FormField from '@cloudscape-design/components/form-field';
import Header from '@cloudscape-design/components/header';
import Input from '@cloudscape-design/components/input';
import Textarea from '@cloudscape-design/components/textarea';
import SpaceBetween from '@cloudscape-design/components/space-between';
import { useState } from 'react';
import { BasicValidationContext } from '../validation/basic-validation';
import { useTranslation } from '../../../hooks/useTranslation';

export default function MeetingDetails() {
  const { t } = useTranslation();
  const [wholeSalePrice, setWholeSalePrice] = useState('');
  const [presenterName, setRetailPrice] = useState('');
  const [additionalNotes, setAdditionalNotes] = useState('');
  const isEmptyString = (value: string) => !value?.length;

  return (
    <BasicValidationContext.Consumer>
      {({ isFormSubmitted, addErrorField }) => {
        const wholeSalePriceErrorText = isEmptyString(wholeSalePrice) && t('createMeeting.meetingDetails.linkRequired');
        const presenterNameErrorText = isEmptyString(presenterName) && t('createMeeting.meetingDetails.presenterRequired');

        return (
          <Container header={<Header variant="h2">{t('createMeeting.meetingDetails.header')}</Header>}>
            <FormField label={t('createMeeting.meetingDetails.pricesLabel')} description={t('createMeeting.meetingDetails.pricesDescription')}>
              <SpaceBetween direction="vertical" size="l">
                <ColumnLayout columns={2}>
                  <FormField
                    label={t('createMeeting.meetingDetails.meetupLinkLabel')}
                    stretch={true}
                    errorText={isFormSubmitted && wholeSalePriceErrorText}
                    i18nStrings={{
                      errorIconAriaLabel: t('createMeeting.meetingDetails.errorIconAriaLabel'),
                    }}
                  >
                    <Input
                      value={wholeSalePrice}
                      onChange={({ detail }) => setWholeSalePrice(detail.value)}
                      type="text"
                      ref={ref => {
                        addErrorField('wholeSalePrice', { isValid: !wholeSalePriceErrorText, ref });
                      }}
                    />
                  </FormField>
                  <FormField
                    label={t('createMeeting.meetingDetails.speakerNamesLabel')}
                    stretch={true}
                    errorText={isFormSubmitted && presenterNameErrorText}
                    i18nStrings={{
                      errorIconAriaLabel: t('createMeeting.meetingDetails.errorIconAriaLabel'),
                    }}
                  >
                    <Input
                      value={presenterName}
                      onChange={({ detail }) => setRetailPrice(detail.value)}
                      type="text"
                      ref={ref => {
                        addErrorField('presenterName', { isValid: !presenterNameErrorText, ref });
                      }}
                    />
                  </FormField>
                </ColumnLayout>
                <FormField
                  label={
                    <>
                      {t('createMeeting.meetingDetails.additionalNotesLabel')}<i>{t('createMeeting.meetingDetails.optional')}</i>
                    </>
                  }
                  stretch={true}
                >
                  <Textarea onChange={({ detail }) => setAdditionalNotes(detail.value)} value={additionalNotes} />
                </FormField>
              </SpaceBetween>
            </FormField>
          </Container>
        );
      }}
    </BasicValidationContext.Consumer>
  );
}

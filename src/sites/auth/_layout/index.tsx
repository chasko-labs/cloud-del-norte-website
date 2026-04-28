// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
import React from 'react';
import Box from '@cloudscape-design/components/box';
import SpaceBetween from '@cloudscape-design/components/space-between';
import { useTranslation } from '../../../hooks/useTranslation';

interface AuthLayoutProps {
  children: React.ReactNode;
  maxWidth?: string;
}

export default function AuthLayout({ children, maxWidth = '480px' }: AuthLayoutProps) {
  const { t } = useTranslation();
  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px 16px',
      }}
    >
      <SpaceBetween size="l">
        <Box textAlign="center">
          <Box variant="h1" fontSize="heading-xl">
            {t('auth.siteTitle')}
          </Box>
        </Box>
        <div style={{ width: '100%', maxWidth }}>{children}</div>
      </SpaceBetween>
    </div>
  );
}

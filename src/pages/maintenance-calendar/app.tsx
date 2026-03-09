// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
import React from 'react';

import Box from '@cloudscape-design/components/box';
import Header from '@cloudscape-design/components/header';

import Breadcrumbs from '../../components/breadcrumbs';
import Navigation from '../../components/navigation';
import ShellLayout from '../../layouts/shell';

export default function App() {
  return (
    <ShellLayout
      contentType="default"
      breadcrumbs={<Breadcrumbs active={{ text: 'Maintenance Calendar', href: '/maintenance-calendar/' }} />}
      navigation={<Navigation />}
    >
      <Box padding="l">
        <Header variant="h1">Maintenance Calendar</Header>
        <Box>Release cadence tracker for 23 technologies. Coming soon.</Box>
      </Box>
    </ShellLayout>
  );
}

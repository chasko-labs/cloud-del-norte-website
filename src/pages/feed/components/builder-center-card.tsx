// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
import React from 'react';
import Container from '@cloudscape-design/components/container';
import Header from '@cloudscape-design/components/header';
import Link from '@cloudscape-design/components/link';
import SpaceBetween from '@cloudscape-design/components/space-between';

export default function BuilderCenterCard() {
  return (
    <Container header={<Header variant="h2">AWS Builder Center</Header>}>
      <div className="feed-builder-card">
        <SpaceBetween size="s">
          <p>Hands-on tutorials, workshops, and guided paths from AWS.</p>
          <Link href="https://builder.aws.com/" external variant="primary">
            Open AWS Builder Center
          </Link>
        </SpaceBetween>
      </div>
    </Container>
  );
}

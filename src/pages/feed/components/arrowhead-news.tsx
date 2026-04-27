// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
import React, { useState } from 'react';
import Container from '@cloudscape-design/components/container';
import Header from '@cloudscape-design/components/header';
import Link from '@cloudscape-design/components/link';
import SpaceBetween from '@cloudscape-design/components/space-between';
import Button from '@cloudscape-design/components/button';
import Box from '@cloudscape-design/components/box';
import Badge from '@cloudscape-design/components/badge';
import articles from '../../../data/arrowhead-news.json';

export default function ArrowheadNews() {
  const [index, setIndex] = useState(0);
  const article = articles[index];
  const total = articles.length;

  return (
    <Container header={<Header variant="h2">Arrowhead Research Park & NMSU</Header>}>
      <SpaceBetween size="m">
        <SpaceBetween size="xs">
          <SpaceBetween size="xs" direction="horizontal">
            <Badge color="blue">{article.source}</Badge>
            <Box color="text-status-inactive" fontSize="body-s">
              {article.date}
            </Box>
          </SpaceBetween>
          <Link href={article.url} external>
            {article.title}
          </Link>
          <Box color="text-body-secondary" fontSize="body-s">
            {article.excerpt}
          </Box>
        </SpaceBetween>
        <SpaceBetween size="xs" direction="horizontal">
          <Button
            variant="icon"
            iconName="angle-left"
            ariaLabel="Previous article"
            disabled={index === 0}
            onClick={() => setIndex(i => i - 1)}
          />
          <Box color="text-status-inactive" fontSize="body-s">
            {index + 1} / {total}
          </Box>
          <Button
            variant="icon"
            iconName="angle-right"
            ariaLabel="Next article"
            disabled={index === total - 1}
            onClick={() => setIndex(i => i + 1)}
          />
        </SpaceBetween>
      </SpaceBetween>
    </Container>
  );
}

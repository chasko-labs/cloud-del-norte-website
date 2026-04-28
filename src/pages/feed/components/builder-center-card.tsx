// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
import React from 'react';
import Container from '@cloudscape-design/components/container';
import Header from '@cloudscape-design/components/header';
import Link from '@cloudscape-design/components/link';
import Icon from '@cloudscape-design/components/icon';
import { useTranslation } from '../../../hooks/useTranslation';

// "top 4" tumblr-style mini-card grid — 4 featured AWS Builder Center articles.
// each card is a compact tile with title + author. clicking opens the article externally.
const TOP_FOUR = [
  {
    title: 'Step Functions without ASL? Welcome Lambda Durable Functions',
    author: 'Andres Moreno',
    url: 'https://builder.aws.com/content/2c0uRhtYh1arjgygZUvxKOspmrw/step-functions-without-asl-welcome-lambda-durable-functions',
  },
  {
    title:
      'Core Concepts of Containers: Technical Intro to Running Software on Containers featuring Amazon ECS Express Mode',
    author: 'Bryan Chasko',
    url: 'https://builder.aws.com/content/38G26lD5rr5GOqDtjfeo3cO4Z1g/core-concepts-of-containers-technical-intro-to-running-software-on-containers-featuring-amazon-ecs-express-mode',
  },
  {
    title: "Applied Technology — Amazon Leo: How AWS Brought Amazon's Project Kuiper to Market",
    author: 'AWS Builder Center',
    url: 'https://builder.aws.com/content/36fvKToWy99YcAK3sDn34yjS6FE/applied-technology-amazon-leo-how-aws-brought-amazons-project-kuiper-to-market',
  },
  {
    title: 'Can it run DOOM? Playing DOOM in Claude Code with DOOM MCP',
    author: 'AWS Builder Center',
    url: 'https://builder.aws.com/content/3AmPDxn7EBkb5DTI9ERcCwPWjqk/can-it-run-doom-playing-doom-in-claude-code-with-doom-mcp',
  },
];

export default function BuilderCenterCard() {
  const { t } = useTranslation();

  return (
    <Container
      header={
        <Header
          variant="h2"
          actions={
            <Link href="https://builder.aws.com/" external fontSize="body-s">
              {t('feedPage.builderCenterOpen')} <Icon name="external" />
            </Link>
          }
        >
          {t('feedPage.builderCenterHeader')}
        </Header>
      }
    >
      <ul className="feed-mini-grid" role="list">
        {TOP_FOUR.map((item, i) => (
          <li key={i} className="feed-mini-card">
            <a href={item.url} target="_blank" rel="noopener noreferrer" className="feed-mini-card__link">
              <span className="feed-mini-card__title">{item.title}</span>
              <span className="feed-mini-card__meta">{item.author}</span>
            </a>
          </li>
        ))}
      </ul>
    </Container>
  );
}

// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
import React, { useEffect, useState } from 'react';
import Container from '@cloudscape-design/components/container';
import Header from '@cloudscape-design/components/header';
import Link from '@cloudscape-design/components/link';
import Icon from '@cloudscape-design/components/icon';
import Box from '@cloudscape-design/components/box';
import { useTranslation } from '../../../hooks/useTranslation';

const FEATURED = [
  {
    title: 'Step Functions without ASL? Welcome Lambda Durable Functions',
    author: 'Andres Moreno',
    url: 'https://builder.aws.com/content/2c0uRhtYh1arjgygZUvxKOspmrw/step-functions-without-asl-welcome-lambda-durable-functions',
    excerpt:
      'Deep dive into Lambda Durable Functions and how they let you run multi-step workflows using familiar code instead of Amazon State Language.',
  },
  {
    title:
      'Core Concepts of Containers: Technical Intro to Running Software on Containers featuring Amazon ECS Express Mode',
    author: 'Bryan Chasko',
    url: 'https://builder.aws.com/content/38G26lD5rr5GOqDtjfeo3cO4Z1g/core-concepts-of-containers-technical-intro-to-running-software-on-containers-featuring-amazon-ecs-express-mode',
    excerpt:
      'A technical introduction to containers, Docker, and ECS Express Mode — what they are, how they work, and why they matter for modern app deployment.',
  },
  {
    title: "Applied Technology — Amazon Leo: How AWS Brought Amazon's Project Kuiper to Market",
    author: 'AWS Builder Center',
    url: 'https://builder.aws.com/content/36fvKToWy99YcAK3sDn34yjS6FE/applied-technology-amazon-leo-how-aws-brought-amazons-project-kuiper-to-market',
    excerpt:
      "Amazon Leo is AWS's new internet backbone. Low-latency, high-bandwidth global connectivity leveraging familiar AWS building blocks scaled to constellation level.",
  },
];

export default function BuilderCenterCard() {
  const { t } = useTranslation();
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused || FEATURED.length <= 1) return;
    const id = setInterval(() => setIndex(i => (i + 1) % FEATURED.length), 6000);
    return () => clearInterval(id);
  }, [paused]);

  const item = FEATURED[index];

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
      <div className="feed-article-carousel" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}>
        <div key={index} className="feed-article-carousel__item">
          <div className="feed-posts__title">
            <Link href={item.url} external>
              {item.title}
            </Link>
          </div>
          <Box color="text-body-secondary" fontSize="body-s">
            {item.excerpt}
          </Box>
          <Box color="text-status-inactive" fontSize="body-s">
            {item.author}
          </Box>
        </div>
        <span className="feed-article-carousel__counter">
          {index + 1} / {FEATURED.length}
        </span>
      </div>
    </Container>
  );
}

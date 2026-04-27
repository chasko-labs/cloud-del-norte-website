// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
import React from 'react';
import Container from '@cloudscape-design/components/container';
import Header from '@cloudscape-design/components/header';
import Link from '@cloudscape-design/components/link';
import Icon from '@cloudscape-design/components/icon';
import SpaceBetween from '@cloudscape-design/components/space-between';
import posts from '../../../data/andres-medium.json';

interface Post {
  title: string;
  excerpt: string;
  date: string;
  url: string;
}

export default function AndresMedium() {
  return (
    <Container
      header={
        <Header
          variant="h2"
          actions={
            <Link href="https://andmoredev.medium.com/" external fontSize="body-s">
              All posts <Icon name="external" />
            </Link>
          }
        >
          Andres Moreno — andmoredev
        </Header>
      }
    >
      <SpaceBetween size="m">
        {(posts as Post[]).map((post, i) => (
          <div key={i} className="feed-posts__item">
            <div className="feed-posts__title">
              <Link href={post.url} external>
                {post.title}
              </Link>
            </div>
            {post.excerpt && <p className="feed-posts__excerpt">{post.excerpt}</p>}
            <span className="feed-posts__meta">{post.date}</span>
          </div>
        ))}
      </SpaceBetween>
    </Container>
  );
}

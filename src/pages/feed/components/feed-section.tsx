// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
import React, { useEffect, useState } from 'react';
import Container from '@cloudscape-design/components/container';
import Header from '@cloudscape-design/components/header';
import Link from '@cloudscape-design/components/link';
import Icon from '@cloudscape-design/components/icon';
import Box from '@cloudscape-design/components/box';
import SpaceBetween from '@cloudscape-design/components/space-between';
import { useTranslation } from '../../../hooks/useTranslation';

interface FeedPost {
  title: string;
  link: string;
  pubDate: string;
  excerpt: string;
}

interface FeedsData {
  andmore: FeedPost[];
  awsml: FeedPost[];
}

function PostCarousel({ posts }: { posts: FeedPost[] }) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused || posts.length <= 1) return;
    const id = setInterval(() => setIndex(i => (i + 1) % posts.length), 6000);
    return () => clearInterval(id);
  }, [paused, posts.length]);

  if (posts.length === 0) {
    return <p className="feed-posts__empty">Check back soon.</p>;
  }

  const post = posts[index];

  return (
    <div className="feed-article-carousel" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}>
      <div key={index} className="feed-article-carousel__item">
        <div className="feed-posts__title">
          <Link href={post.link} external>
            {post.title}
          </Link>
        </div>
        {post.excerpt && (
          <Box color="text-body-secondary" fontSize="body-s">
            {post.excerpt}
          </Box>
        )}
        <Box color="text-status-inactive" fontSize="body-s">
          {post.pubDate}
        </Box>
      </div>
      <div className="feed-article-carousel__progress" aria-hidden="true">
        <div
          key={`progress-${index}`}
          className={`feed-article-carousel__progress-fill${paused ? '' : ' feed-article-carousel__progress-fill--running'}`}
        />
      </div>
      <div className="feed-article-carousel__dots" role="tablist" aria-label="article selector">
        {posts.map((_: FeedPost, i: number) => (
          <button
            key={i}
            role="tab"
            aria-selected={i === index}
            aria-label={`article ${i + 1} of ${posts.length}`}
            className={`feed-article-carousel__dot${i === index ? ' feed-article-carousel__dot--active' : ''}`}
            onClick={() => {
              setIndex(i);
              setPaused(true);
            }}
          />
        ))}
      </div>
    </div>
  );
}

export default function FeedSection() {
  const { t } = useTranslation();
  const [data, setData] = useState<FeedsData | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetch('/data/feeds.json')
      .then(res => {
        if (!res.ok) throw new Error('fetch failed');
        return res.json() as Promise<FeedsData>;
      })
      .then(setData)
      .catch(() => setError(true));
  }, []);

  if (error) {
    return (
      <Container header={<Header variant="h2">{t('feedPage.andmoreDotDev')}</Header>}>
        <p className="feed-posts__empty">Feed unavailable — check back soon.</p>
      </Container>
    );
  }

  const andmore = data?.andmore?.slice(0, 5) ?? [];
  const awsml = data?.awsml?.slice(0, 5) ?? [];

  return (
    <SpaceBetween size="m">
      <Container
        header={
          <Header
            variant="h2"
            actions={
              <Link href="https://andmore.dev" external fontSize="body-s">
                All posts <Icon name="external" />
              </Link>
            }
          >
            {t('feedPage.andmoreDotDev')}
          </Header>
        }
      >
        <PostCarousel posts={andmore} />
      </Container>
      <Container
        header={
          <Header
            variant="h2"
            actions={
              <Link href="https://aws.amazon.com/blogs/machine-learning/" external fontSize="body-s">
                All posts <Icon name="external" />
              </Link>
            }
          >
            {t('feedPage.awsMlBlog')}
          </Header>
        }
      >
        <PostCarousel posts={awsml} />
      </Container>
    </SpaceBetween>
  );
}

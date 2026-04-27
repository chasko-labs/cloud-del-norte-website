// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
import React, { useEffect, useState } from 'react';
import Container from '@cloudscape-design/components/container';
import Header from '@cloudscape-design/components/header';
import SpaceBetween from '@cloudscape-design/components/space-between';
import Link from '@cloudscape-design/components/link';

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

function PostList({ posts }: { posts: FeedPost[] }) {
  if (posts.length === 0) {
    return <p className="feed-posts__empty">Check back soon.</p>;
  }
  return (
    <div>
      {posts.map((post, i) => (
        <div key={i} className="feed-posts__item">
          <div className="feed-posts__title">
            <Link href={post.link} external>
              {post.title}
            </Link>
          </div>
          {post.excerpt && <p className="feed-posts__excerpt">{post.excerpt}</p>}
          <span className="feed-posts__meta">{post.pubDate}</span>
        </div>
      ))}
    </div>
  );
}

export default function FeedSection() {
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

  const andmore = data?.andmore?.slice(0, 3) ?? [];
  const awsml = data?.awsml?.slice(0, 3) ?? [];

  if (error) {
    return (
      <Container header={<Header variant="h2">Community Feed</Header>}>
        <p className="feed-posts__empty">Feed unavailable — check back soon.</p>
      </Container>
    );
  }

  return (
    <SpaceBetween size="m">
      <Container header={<Header variant="h2">andmore.dev</Header>}>
        <PostList posts={andmore} />
      </Container>
      <Container header={<Header variant="h2">AWS Machine Learning Blog</Header>}>
        <PostList posts={awsml} />
      </Container>
    </SpaceBetween>
  );
}

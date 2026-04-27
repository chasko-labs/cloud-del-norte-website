// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
import React, { useState, useEffect } from 'react';
import Container from '@cloudscape-design/components/container';
import Header from '@cloudscape-design/components/header';

const CHANNELS = [
  { id: 'aws', label: 'AWS', url: 'https://www.twitch.tv/aws' },
  { id: 'awsonair', label: 'AWS on Air', url: 'https://www.twitch.tv/awsonair' },
];

export default function TwitchSection() {
  const [hostname, setHostname] = useState<string | null>(null);

  useEffect(() => {
    setHostname(window.location.hostname);
  }, []);

  return (
    <Container header={<Header variant="h2">Live on Twitch</Header>}>
      <div className="feed-twitch">
        {CHANNELS.map(channel => (
          <div key={channel.id} className="feed-twitch__channel">
            <span className="feed-twitch__label">{channel.label}</span>
            {hostname ? (
              <div className="feed-twitch__frame">
                <iframe
                  src={`https://player.twitch.tv/?channel=${channel.id}&parent=${hostname}&autoplay=false`}
                  title={`${channel.label} Twitch stream`}
                  allowFullScreen
                />
              </div>
            ) : (
              <p className="feed-twitch__fallback">
                <a href={channel.url} target="_blank" rel="noopener noreferrer">
                  Watch {channel.label} on Twitch
                </a>
              </p>
            )}
          </div>
        ))}
      </div>
    </Container>
  );
}

// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
import React, { useEffect, useRef, useState } from 'react';
import Container from '@cloudscape-design/components/container';
import Header from '@cloudscape-design/components/header';
import { useTranslation } from '../../../hooks/useTranslation';

// Twitch Embed SDK types (loaded via script tag at runtime)
interface TwitchEmbed {
  getPlayer(): TwitchPlayer;
  addEventListener(event: string, callback: () => void): void;
}
interface TwitchPlayer {
  addEventListener(event: string, callback: () => void): void;
}
interface TwitchEmbedConstructor {
  new (el: HTMLElement, opts: Record<string, unknown>): TwitchEmbed;
  VIDEO_READY: string;
}
interface TwitchStatic {
  Embed: TwitchEmbedConstructor;
  Player: { OFFLINE: string; ONLINE: string };
}

declare global {
  interface Window {
    Twitch?: TwitchStatic;
  }
}

const CHANNELS = [
  {
    id: 'aws',
    label: 'AWS',
    // Most recent AWS channel recording — update when a new notable stream is archived
    fallbackVideoId: 'yQNrgpIp1Fs',
  },
  {
    id: 'awsonair',
    label: 'AWS on Air',
    // Most recent AWS on Air recording — update periodically
    fallbackVideoId: 'WUJUvTu2Qjo',
  },
];

let twitchScriptLoading = false;
const twitchReadyCallbacks: Array<() => void> = [];

function loadTwitchSDK(onReady: () => void) {
  if (window.Twitch) {
    onReady();
    return;
  }
  twitchReadyCallbacks.push(onReady);
  if (twitchScriptLoading) return;
  twitchScriptLoading = true;
  const script = document.createElement('script');
  script.src = 'https://embed.twitch.tv/embed/v1.js';
  script.async = true;
  script.onload = () => {
    twitchScriptLoading = false;
    twitchReadyCallbacks.splice(0).forEach(cb => cb());
  };
  document.head.appendChild(script);
}

function TwitchChannelEmbed({
  channelId,
  label,
  hostname,
  fallbackVideoId,
}: {
  channelId: string;
  label: string;
  hostname: string;
  fallbackVideoId: string;
}) {
  const { t } = useTranslation();
  const containerRef = useRef<HTMLDivElement>(null);
  const [offline, setOffline] = useState(false);
  const [live, setLive] = useState(false);

  useEffect(() => {
    if (!containerRef.current) return;
    const el = containerRef.current;

    loadTwitchSDK(() => {
      const twitch = window.Twitch;
      if (!twitch || !el) return;
      const embed = new twitch.Embed(el, {
        width: '100%',
        height: 300,
        channel: channelId,
        parent: [hostname],
        autoplay: false,
        layout: 'video',
      });
      embed.addEventListener(twitch.Embed.VIDEO_READY, () => {
        const player = embed.getPlayer();
        player.addEventListener(twitch.Player.OFFLINE, () => {
          setOffline(true);
          setLive(false);
        });
        player.addEventListener(twitch.Player.ONLINE, () => {
          setOffline(false);
          setLive(true);
        });
      });
    });
  }, [channelId, hostname]);

  return (
    <div className="feed-twitch__channel">
      <span className="feed-twitch__label">
        {label}
        {live && <span style={{ color: '#e91916', marginLeft: '0.4em' }}>· {t('feedPage.twitchLive')}</span>}
        {offline && (
          <span style={{ opacity: 0.6, marginLeft: '0.4em', fontSize: '0.8em' }}>
            · {t('feedPage.twitchRecentVideo')}
          </span>
        )}
      </span>
      {/* Twitch embed container: always in DOM once initialized so SDK doesn't lose state */}
      <div style={{ display: offline ? 'none' : 'block' }}>
        <div ref={containerRef} style={{ width: '100%', height: 300 }} />
      </div>
      {offline && (
        <div className="feed-twitch__frame">
          <iframe
            loading="lazy"
            src={`https://www.youtube.com/embed/${fallbackVideoId}?autoplay=0`}
            title={`${label} ${t('feedPage.twitchRecentVideo')}`}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
      )}
    </div>
  );
}

export default function TwitchSection() {
  const [hostname, setHostname] = useState<string | null>(null);

  useEffect(() => {
    setHostname(window.location.hostname);
  }, []);

  return (
    <Container header={<Header variant="h2">Live on Twitch</Header>}>
      <div className="feed-twitch">
        {CHANNELS.map(channel =>
          hostname ? (
            <TwitchChannelEmbed
              key={channel.id}
              channelId={channel.id}
              label={channel.label}
              hostname={hostname}
              fallbackVideoId={channel.fallbackVideoId}
            />
          ) : (
            <div key={channel.id} className="feed-twitch__channel">
              <span className="feed-twitch__label">{channel.label}</span>
              <p className="feed-twitch__fallback">
                <a href={`https://www.twitch.tv/${channel.id}`} target="_blank" rel="noopener noreferrer">
                  Watch {channel.label} on Twitch
                </a>
              </p>
            </div>
          ),
        )}
      </div>
    </Container>
  );
}

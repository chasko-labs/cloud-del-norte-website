// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
import React, { useCallback, useEffect, useRef, useState, useMemo } from 'react';
import ContentLayout from '@cloudscape-design/components/content-layout';
import Header from '@cloudscape-design/components/header';
import Link from '@cloudscape-design/components/link';
import Navigation from '../../components/navigation';
import Breadcrumbs from '../../components/breadcrumbs';
import Shell from '../../layouts/shell';
import { HelpPanelHome } from '../create-meeting/components/help-panel-home';
import { initializeTheme, applyTheme, setStoredTheme, type Theme } from '../../utils/theme';
import { initializeLocale, applyLocale, setStoredLocale, type Locale } from '../../utils/locale';
import { useTranslation } from '../../hooks/useTranslation';
import YoutubeCarousel from './components/youtube-carousel';
import { TwitchAws, TwitchAwsOnAir } from './components/twitch-section';
import { FeedAndmore, FeedAwsml } from './components/feed-section';
import BuilderCenterCard from './components/builder-center-card';
import ArrowheadNews from './components/arrowhead-news';
import NextMeetup from './components/next-meetup';
import './styles.css';

interface StreamDef {
  readonly key: string;
  readonly url: string;
  readonly label: string;
  readonly metaUrl: string;
  parseMeta(data: unknown): string | null;
}

const STREAMS: StreamDef[] = [
  {
    key: 'krux',
    url: 'https://kruxstream.nmsu.edu/KRUX',
    label: 'krux 91.5',
    metaUrl: 'https://kruxstream.nmsu.edu/status-json.xsl',
    parseMeta(data) {
      const d = data as { icestats?: { source?: { title?: string } | Array<{ title?: string }> } };
      const src = d?.icestats?.source;
      const s = Array.isArray(src) ? src[0] : src;
      return s?.title ?? null;
    },
  },
  {
    key: 'kexp',
    url: 'https://kexp.streamguys1.com/kexp160.aac',
    label: 'kexp 90.3',
    metaUrl: 'https://api.kexp.org/v2/plays/?limit=1&format=json',
    parseMeta(data) {
      const d = data as { results?: Array<{ artist_name?: string; song?: string }> };
      const play = d?.results?.[0];
      if (!play) return null;
      const { artist_name: artist, song } = play;
      if (artist && song) return `${song} — ${artist}`;
      return song ?? artist ?? null;
    },
  },
];

const CAROUSEL_MS = 10_000;
const FADE_MS = 500;
const POLL_MS = 30_000;

function KruxPlayer() {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [idx, setIdx] = useState(0);
  const [fading, setFading] = useState(false);
  const [nowPlaying, setNowPlaying] = useState<Record<string, string>>({});
  const [carouselVersion, setCarouselVersion] = useState(0);
  const resumeOnSkipRef = useRef(false);

  const stream = STREAMS[idx];

  const fetchMeta = useCallback((s: StreamDef) => {
    fetch(s.metaUrl)
      .then(r => (r.ok ? r.json() : null))
      .then((data: unknown) => {
        if (!data) return;
        const text = s.parseMeta(data);
        if (text) setNowPlaying(prev => ({ ...prev, [s.key]: text }));
      })
      .catch(() => {});
  }, []);

  // fetch both stations on mount for initial now-playing display
  useEffect(() => {
    STREAMS.forEach(s => fetchMeta(s));
  }, [fetchMeta]);

  // carousel: fade out → swap station → fade in, every 10s while not playing
  useEffect(() => {
    if (playing) return;
    let tid: ReturnType<typeof setTimeout> | null = null;
    const id = setInterval(() => {
      setFading(true);
      tid = setTimeout(() => {
        setIdx(i => (i + 1) % STREAMS.length);
        setFading(false);
        tid = null;
      }, FADE_MS);
    }, CAROUSEL_MS);
    return () => {
      clearInterval(id);
      if (tid) clearTimeout(tid);
    };
  }, [playing, carouselVersion]);

  // poll now-playing every 30s while playing
  useEffect(() => {
    if (!playing) return;
    fetchMeta(stream);
    const id = setInterval(() => fetchMeta(stream), POLL_MS);
    return () => clearInterval(id);
  }, [playing, stream, fetchMeta]);

  // after a skip: if a stream was playing, reload the new src and resume
  useEffect(() => {
    if (!resumeOnSkipRef.current) return;
    resumeOnSkipRef.current = false;
    const a = audioRef.current;
    if (!a) return;
    setLoading(true);
    a.load();
    a.play().catch(() => setLoading(false));
  }, [idx]);

  const skipStation = useCallback(() => {
    const a = audioRef.current;
    const wasPlaying = a ? !a.paused : false;
    if (wasPlaying && a) {
      a.pause();
    }
    resumeOnSkipRef.current = wasPlaying;
    setFading(true);
    setTimeout(() => {
      setIdx(i => (i + 1) % STREAMS.length);
      setFading(false);
      if (!wasPlaying) setCarouselVersion(v => v + 1);
    }, FADE_MS);
  }, []);

  const toggle = useCallback(() => {
    const a = audioRef.current;
    if (!a) return;
    if (a.paused) {
      setLoading(true);
      a.play()
        .then(() => setLoading(false))
        .catch(() => setLoading(false));
    } else {
      a.pause();
    }
  }, []);

  return (
    <div className="feed-krux">
      <div className="feed-krux__top">
        <button
          type="button"
          className="feed-krux__skip"
          onClick={skipStation}
          aria-label={`next station: ${STREAMS[(idx + 1) % STREAMS.length].label}`}
        >
          <span aria-hidden="true">⏭</span>
        </button>
        {/* label is a secondary click target — aria-hidden so screen readers
            only interact with the labelled round button below */}
        <button
          type="button"
          className={`feed-krux__label${playing ? ' feed-krux__label--playing' : ''}`}
          onClick={toggle}
          aria-hidden="true"
          tabIndex={-1}
        >
          <span className={`feed-krux__headphones${playing ? ' feed-krux__headphones--playing' : ''}`}>🎧</span>
          <span className={`feed-krux__station${fading ? ' feed-krux__station--fading' : ''}`}>{stream.label}</span>
        </button>
        <button
          type="button"
          className="feed-krux__btn"
          onClick={toggle}
          aria-pressed={playing}
          aria-label={playing ? `stop ${stream.label}` : `play ${stream.label}`}
          data-state={loading ? 'loading' : playing ? 'playing' : 'paused'}
        >
          <span aria-hidden="true">{playing ? '■' : '▶'}</span>
        </button>
      </div>
      {nowPlaying[stream.key] && (
        <span className="feed-krux__now-playing" aria-live="polite" aria-atomic="true">
          {nowPlaying[stream.key]}
        </span>
      )}
      <audio
        ref={audioRef}
        src={stream.url}
        preload="none"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
        onWaiting={() => setLoading(true)}
        onPlaying={() => setLoading(false)}
      />
    </div>
  );
}

// builder center top-4 is rendered as its own pinned section (between two hr
// dividers, just below next-meetup) — NOT part of the rotating shuffled feed.
// twitch was previously one full-span card with two panes; split into per-channel
// cards so the 2-up grid is even (6 cells, 3 rows of 2 instead of 5 with one wide).
type SectionKey = 'youtube' | 'twitchAws' | 'twitchAwsOnAir' | 'andmore' | 'awsml' | 'arrowhead';

const SECTIONS: Partial<Record<SectionKey, React.ReactNode>> = {
  youtube: <YoutubeCarousel />,
  twitchAws: <TwitchAws />,
  twitchAwsOnAir: <TwitchAwsOnAir />,
  andmore: <FeedAndmore />,
  awsml: <FeedAwsml />,
  arrowhead: <ArrowheadNews />,
};

function shuffled<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function AppContent({
  theme,
  onThemeChange,
  locale,
  onLocaleChange,
  onOpenTools,
}: {
  theme: Theme;
  onThemeChange: (t: Theme) => void;
  locale: Locale;
  onLocaleChange: (l: Locale) => void;
  onOpenTools: () => void;
}) {
  const { t } = useTranslation();

  // Shuffle order is stable for the lifetime of this page load
  const order = useMemo(() => shuffled(Object.keys(SECTIONS) as SectionKey[]), []);

  return (
    <ContentLayout
      header={
        <Header
          variant="h1"
          info={
            <Link
              variant="info"
              onFollow={e => {
                e.preventDefault();
                onOpenTools();
              }}
              ariaLabel={t('feedPage.infoLinkAriaLabel')}
            >
              {t('feedPage.infoLink')}
            </Link>
          }
          actions={<KruxPlayer />}
        >
          {t('feedPage.header')}
        </Header>
      }
    >
      <div className="feed-grid__cell cdn-card feed-grid__cell--full">
        <NextMeetup />
      </div>
      <hr className="feed-section-divider" />
      <div className="feed-grid__cell cdn-card feed-grid__cell--full">
        <BuilderCenterCard />
      </div>
      <hr className="feed-section-divider" />
      <div className="feed-grid">
        {order.map(key => (
          <div key={key} className="feed-grid__cell cdn-card">
            {SECTIONS[key]}
          </div>
        ))}
      </div>
    </ContentLayout>
  );
}

function BreadcrumbsContent() {
  const { t } = useTranslation();
  return <Breadcrumbs active={{ text: t('feedPage.breadcrumb'), href: '/feed/index.html' }} />;
}

export default function App() {
  const [theme, setTheme] = useState<Theme>(() => initializeTheme());
  const [locale, setLocale] = useState<Locale>(() => initializeLocale());
  const [toolsOpen, setToolsOpen] = useState(false);

  const handleThemeChange = (newTheme: Theme) => {
    setTheme(newTheme);
    applyTheme(newTheme);
    setStoredTheme(newTheme);
  };

  const handleLocaleChange = (newLocale: Locale) => {
    setLocale(newLocale);
    applyLocale(newLocale);
    setStoredLocale(newLocale);
  };

  return (
    <Shell
      theme={theme}
      onThemeChange={handleThemeChange}
      locale={locale}
      onLocaleChange={handleLocaleChange}
      breadcrumbs={<BreadcrumbsContent />}
      navigation={<Navigation />}
      tools={<HelpPanelHome />}
      toolsOpen={toolsOpen}
      onToolsChange={setToolsOpen}
    >
      <AppContent
        theme={theme}
        onThemeChange={handleThemeChange}
        locale={locale}
        onLocaleChange={handleLocaleChange}
        onOpenTools={() => setToolsOpen(true)}
      />
    </Shell>
  );
}

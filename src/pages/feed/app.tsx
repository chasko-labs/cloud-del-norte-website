// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
import React, { useEffect, useRef, useState, useMemo } from 'react';
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
import TwitchSection from './components/twitch-section';
import FeedSection from './components/feed-section';
import BuilderCenterCard from './components/builder-center-card';
import ArrowheadNews from './components/arrowhead-news';
import NextMeetup from './components/next-meetup';
import './styles.css';

// detect browser-side OS from userAgent — minimal, no library
function detectOS(): string {
  if (typeof navigator === 'undefined') return 'unknown';
  const ua = navigator.userAgent;
  if (/Windows NT 10/.test(ua)) return 'windows 10/11';
  if (/Windows/.test(ua)) return 'windows';
  if (/Mac OS X/.test(ua)) return 'macos';
  if (/Android/.test(ua)) return 'android';
  if (/iPhone|iPad|iPod/.test(ua)) return 'ios';
  if (/Linux/.test(ua)) return 'linux';
  return 'unknown';
}

interface VisitorInfo {
  ip: string;
  country: string;
}

// liora panel — renders inside the left side navigation drawer, below SideNavigation
// only mounts on dev.clouddelnorte.org and localhost; prod omits entirely
function LioraSidebar() {
  const hostRef = useRef<HTMLDivElement>(null);
  const mounted = useRef(false);
  const [viewport, setViewport] = useState<string>('');
  const [os] = useState<string>(() => detectOS());
  const [visitor, setVisitor] = useState<VisitorInfo | null>(null);

  useEffect(() => {
    if (mounted.current || !hostRef.current) return;
    mounted.current = true;

    const el = hostRef.current;
    el.style.display = '';

    const s = document.createElement('script');
    s.type = 'module';
    s.textContent = [
      "import { mountLioraPanel } from '/liora-embed/liora-embed.js';",
      "var h = document.getElementById('liora-host-react');",
      "if (h) mountLioraPanel('/liora');",
    ].join('\n');
    document.body.appendChild(s);
  }, []);

  // viewport size — track on resize
  useEffect(() => {
    const update = () => setViewport(`${window.innerWidth}×${window.innerHeight}`);
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  // visitor ip + country — single fetch on mount, free api, no key
  useEffect(() => {
    let cancelled = false;
    fetch('https://ipapi.co/json/')
      .then(r => (r.ok ? r.json() : null))
      .then(data => {
        if (cancelled || !data) return;
        setVisitor({ ip: data.ip ?? '—', country: data.country_name ?? data.country ?? '—' });
      })
      .catch(() => {
        // network/cors failure — leave visitor null, panel renders without ip/country rows
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="liora-sidebar">
      <div className="liora-bezel" style={{ display: 'none' }} id="liora-host-react" ref={hostRef}>
        <div className="liora-panel-wrap">
          <canvas id="liora-canvas" aria-hidden="true"></canvas>
          <div id="liora-shimmer" aria-hidden="true"></div>
          <div id="liora-status-bar" role="status" aria-live="polite">
            <span id="liora-sys-status"></span>
          </div>
        </div>
      </div>
      <dl className="liora-sidebar__info" aria-label="visitor session info">
        <div className="liora-sidebar__info-row">
          <dt>os</dt>
          <dd>{os}</dd>
        </div>
        <div className="liora-sidebar__info-row">
          <dt>display</dt>
          <dd>{viewport || '—'}</dd>
        </div>
        {visitor && (
          <>
            <div className="liora-sidebar__info-row">
              <dt>ip</dt>
              <dd>{visitor.ip}</dd>
            </div>
            <div className="liora-sidebar__info-row">
              <dt>country</dt>
              <dd>{visitor.country}</dd>
            </div>
          </>
        )}
      </dl>
    </div>
  );
}

// hostname check runs once at module init — stable for page lifetime
const IS_DEV =
  typeof window !== 'undefined' &&
  (window.location.hostname === 'dev.clouddelnorte.org' || window.location.hostname === 'localhost');

type SectionKey = 'youtube' | 'twitch' | 'feed' | 'builder' | 'arrowhead';

const SECTIONS: Partial<Record<SectionKey, React.ReactNode>> = {
  youtube: <YoutubeCarousel />,
  twitch: <TwitchSection />,
  feed: <FeedSection />,
  builder: <BuilderCenterCard />,
  arrowhead: <ArrowheadNews />,
};

// twitch already shows two channel panes side by side — span the full grid width
// so it doesn't squeeze into a single column. all other cells fit the 2-up tablet grid.
const FULL_SPAN_SECTIONS = new Set<SectionKey>(['twitch']);

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
        >
          {t('feedPage.header')}
        </Header>
      }
    >
      <NextMeetup />
      <hr className="feed-section-divider" />
      <div className="feed-grid">
        {order.map(key => (
          <div key={key} className={`feed-grid__cell${FULL_SPAN_SECTIONS.has(key) ? ' feed-grid__cell--full' : ''}`}>
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
      navigation={
        <>
          <Navigation />
          {IS_DEV && <LioraSidebar />}
        </>
      }
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

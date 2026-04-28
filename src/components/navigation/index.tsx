// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
import React, { useEffect, useMemo, useState } from 'react';
import SideNavigation, { SideNavigationProps } from '@cloudscape-design/components/side-navigation';
import { useTranslation } from '../../hooks/useTranslation';
import { useAuth } from '../../hooks/useAuth';
import './liora.css';

function detectDeviceInfo(): string {
  if (typeof navigator === 'undefined') return '';
  const ua = navigator.userAgent;
  let os = 'linux';
  if (/android/i.test(ua)) os = 'android';
  else if (/iphone/i.test(ua)) os = 'ios';
  else if (/ipad/i.test(ua) || (/macintosh/i.test(ua) && 'ontouchend' in document)) os = 'ipados';
  else if (/windows/i.test(ua)) os = 'windows';
  else if (/mac os x/i.test(ua)) os = 'macos';
  const w = window.screen.width;
  const h = window.screen.height;
  return `os:${os}  ${w}×${h}`;
}

function scheduleIdle(fn: () => void) {
  if ('requestIdleCallback' in window) {
    (
      window as Window & { requestIdleCallback: (cb: () => void, opts: { timeout: number }) => void }
    ).requestIdleCallback(fn, { timeout: 4000 });
  } else {
    setTimeout(fn, 200);
  }
}

function LioraFrame() {
  const deviceInfo = useMemo(() => detectDeviceInfo(), []);
  const [stickyZoomed, setStickyZoomed] = useState(false);
  const [stickyKey, setStickyKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    let observer: ResizeObserver | null = null;

    async function mount() {
      if (cancelled) return;
      // use a data attribute on the canvas element as the mount guard — React StrictMode reuses
      // the same DOM element across simulated unmount/remount, so this persists where a
      // module-level flag would be left true by a cancelled first run and block the second
      const canvasEl = document.getElementById('liora-canvas');
      if (canvasEl?.dataset.lioraMounted === '1') return;
      canvasEl?.setAttribute('data-liora-mounted', '1');
      try {
        const origin = window.location.origin;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const mod = (await (Function('u', 'return import(u)') as (u: string) => Promise<any>)(
          `${origin}/liora-embed/liora-embed.js`,
        )) as { mountLioraPanel: (base: string) => Promise<void> };
        if (cancelled) return;
        await mod.mountLioraPanel(`${origin}/liora`);
      } catch {
        canvasEl?.removeAttribute('data-liora-mounted');
        /* embed unavailable — canvas stays as shimmer */
      }
    }

    function tryMount() {
      if (cancelled) return;
      const canvas = document.getElementById('liora-canvas');
      if (canvas && (canvas as HTMLCanvasElement).clientWidth === 0) {
        observer = new ResizeObserver(() => {
          if (cancelled) {
            observer?.disconnect();
            return;
          }
          if ((canvas as HTMLCanvasElement).clientWidth > 0) {
            observer?.disconnect();
            observer = null;
            mount();
          }
        });
        observer.observe(canvas);
        return;
      }
      mount();
    }

    if (document.readyState === 'complete') {
      scheduleIdle(tryMount);
    } else {
      window.addEventListener('load', () => scheduleIdle(tryMount), { once: true });
    }

    return () => {
      cancelled = true;
      observer?.disconnect();
    };
  }, []);

  return (
    <div className="liora-frame">
      <div className="liora-bezel">
        <div className="liora-panel-wrap">
          <div id="liora-shimmer" className="liora-placeholder" aria-hidden="true">
            <span className="liora-placeholder-label">
              modem connecting
              <span className="liora-block-stream">
                <span className="liora-block">▓</span>
                <span className="liora-block">▓</span>
                <span className="liora-block">▓</span>
              </span>
            </span>
          </div>
          <canvas id="liora-canvas" className="liora-canvas" aria-hidden="true" tabIndex={-1} />
        </div>
        <div id="liora-status-bar" className="liora-status-bar liora-status--green" aria-hidden="true">
          <span id="liora-device-info">{deviceInfo}</span>
          <span id="liora-sys-status"> SYS:▓▓▓</span>
        </div>
      </div>
      <button
        key={stickyKey}
        type="button"
        className={`liora-stickynote${stickyZoomed ? ' liora-stickynote--zoomed' : ''}`}
        onClick={() => {
          const bezel = document.querySelector('.liora-bezel');
          if (
            bezel instanceof HTMLElement &&
            (bezel.classList.contains('screen-tap-1') || bezel.classList.contains('screen-tap-2'))
          )
            return;
          setStickyZoomed(v => !v);
          setStickyKey(k => k + 1);
        }}
        aria-label={stickyZoomed ? 'shrink sticky note' : 'zoom into sticky note'}
      >
        <span className="liora-stickynote-line liora-stickynote-line-1">non load</span>
        <span className="liora-stickynote-line liora-stickynote-line-2">bearing</span>
        <span className="liora-stickynote-sig">- ^.^</span>
      </button>
    </div>
  );
}

export default function Navigation() {
  const { t } = useTranslation();
  const { isModerator } = useAuth();

  // home (feed) is reachable via the "cloud del norte" header above and the top-nav title.
  // about is reachable from the right-side info panel only — not duplicated in the left nav.
  const items: SideNavigationProps['items'] = [
    { type: 'link', text: t('navigation.meetings'), href: '/meetings/index.html' },
    ...(isModerator ? [{ type: 'link' as const, text: t('navigation.admin'), href: '/admin/index.html' }] : []),
    { type: 'divider' },
    {
      type: 'section',
      text: t('navigation.resources'),
      defaultExpanded: false,
      items: [
        { type: 'link', text: t('navigation.ugRoadmap'), href: '/roadmap/index.html' },
        { type: 'link', text: t('navigation.techDebtCountdowns'), href: '/maintenance-calendar/' },
        { type: 'link', text: t('navigation.designSystem'), href: '/theme/index.html' },
      ],
    },
    { type: 'divider' },
    {
      type: 'section',
      text: t('navigation.learning'),
      defaultExpanded: false,
      items: [
        {
          type: 'expandable-link-group',
          text: t('navigation.apiGuide'),
          href: '/learning/api/',
          defaultExpanded: false,
          items: [
            { type: 'link', text: t('navigation.restOverview'), href: '/learning/api/#overview' },
            { type: 'link', text: t('navigation.uniformInterface'), href: '/learning/api/#uniform-interface' },
            { type: 'link', text: t('navigation.clientServer'), href: '/learning/api/#client-server' },
            { type: 'link', text: t('navigation.stateless'), href: '/learning/api/#stateless' },
            { type: 'link', text: t('navigation.cacheable'), href: '/learning/api/#cacheable' },
            { type: 'link', text: t('navigation.layeredSystem'), href: '/learning/api/#layered-system' },
            { type: 'link', text: t('navigation.codeOnDemand'), href: '/learning/api/#code-on-demand' },
            { type: 'link', text: t('navigation.cheatSheet'), href: '/learning/api/#cheat-sheet' },
            { type: 'link', text: t('navigation.howItWorks'), href: '/learning/api/#how-it-works' },
            { type: 'link', text: t('navigation.projectResources'), href: '/learning/api/#resources' },
          ],
        },
      ],
    },
  ];

  return (
    <>
      <SideNavigation
        activeHref={location.pathname}
        header={{ href: '/feed/index.html', text: t('shell.siteTitle') }}
        items={items}
        onFollow={event => {
          if (event.detail.type === 'section-header') return;
          const href = event.detail.href;
          if (!event.detail.external && href && href !== '#') {
            event.preventDefault();
            window.location.href = href;
          }
        }}
      />
      <LioraFrame />
    </>
  );
}

// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

/**
 * NextMeetup — fetches the next upcoming AWS UG Cloud Del Norte event from
 * the meetup.com iCal feed and renders it above the rotating sections grid.
 *
 * CORS note: meetup.com does not serve CORS headers for direct browser fetches.
 * The iCal fetch will fail in production with a CORS error (no-cors mode returns
 * an opaque response that cannot be read). The component handles this gracefully
 * by falling back to a "Visit meetup.com" CTA card.
 *
 * Proposed CI step (follow-up for Harald):
 *   - Add a Woodpecker pipeline step that runs on a schedule (weekly or on push)
 *   - Step fetches https://www.meetup.com/awsugclouddelnorte/events/ical/ from
 *     the CI environment (no CORS restriction server-side)
 *   - Parses the first future VEVENT and writes the result to
 *     public/data/next-meetup.json as a static file
 *   - The component can then try /data/next-meetup.json first, fall back to
 *     the CTA card if the file is absent or stale (>30 days old)
 *   - File schema: { summary, dtstart (ISO 8601), location, url, description }
 *   - Dispatch to Harald as issue: "feat(feed): CI step for next-meetup.json static gen"
 */

import React, { useEffect, useState } from 'react';
import Container from '@cloudscape-design/components/container';
import Header from '@cloudscape-design/components/header';
import Link from '@cloudscape-design/components/link';
import SpaceBetween from '@cloudscape-design/components/space-between';
import Box from '@cloudscape-design/components/box';
import Button from '@cloudscape-design/components/button';
import { useTranslation } from '../../../hooks/useTranslation';

const MEETUP_GROUP = 'awsugclouddelnorte';
const MEETUP_ICAL = `https://www.meetup.com/${MEETUP_GROUP}/events/ical/`;
const MEETUP_GROUP_URL = `https://www.meetup.com/${MEETUP_GROUP}/`;
const STATIC_DATA_URL = '/data/next-meetup.json';
const MAX_DESCRIPTION_CHARS = 200;

interface MeetupEvent {
  summary: string;
  dtstart: string; // ISO 8601
  location?: string;
  url?: string;
  description?: string;
  isPast: boolean;
}

/** Parse a VEVENT block from an iCal string. Returns the single event
 *  with the nearest future DTSTART, or the most recent past event as fallback. */
function parseIcal(text: string): MeetupEvent | null {
  const events: Array<Omit<MeetupEvent, 'isPast'>> = [];
  const veventBlocks = text.split('BEGIN:VEVENT').slice(1);

  for (const block of veventBlocks) {
    const end = block.indexOf('END:VEVENT');
    const body = end !== -1 ? block.slice(0, end) : block;

    const getField = (name: string): string => {
      // iCal fields can be folded (continuation lines start with space/tab)
      const regex = new RegExp(`^${name}[^:]*:(.+?)(?=\\r?\\n[^ \\t]|$)`, 'ms');
      const m = body.match(regex);
      if (!m) return '';
      // unfold: join continuation lines
      return m[1].replace(/\r?\n[ \t]/g, '').trim();
    };

    const rawDtstart = getField('DTSTART');
    if (!rawDtstart) continue;

    // iCal DATE or DATETIME formats: 20260415T180000Z or 20260415
    const iso = rawDtstart.replace(
      /^(\d{4})(\d{2})(\d{2})(T(\d{2})(\d{2})(\d{2})(Z?))?$/,
      (_m, y, mo, d, _t, h = '00', mi = '00', s = '00', z = '') => `${y}-${mo}-${d}T${h}:${mi}:${s}${z || '+00:00'}`,
    );

    const rawSummary = getField('SUMMARY');
    const rawUrl = getField('URL');
    const rawLocation = getField('LOCATION');
    const rawDesc = getField('DESCRIPTION');

    events.push({
      summary: rawSummary || 'AWS UG Cloud Del Norte Meetup',
      dtstart: iso,
      location: rawLocation || undefined,
      url: rawUrl || MEETUP_GROUP_URL,
      description: rawDesc
        ? rawDesc.replace(/\\n/g, ' ').replace(/\\,/g, ',').slice(0, MAX_DESCRIPTION_CHARS)
        : undefined,
    });
  }

  if (events.length === 0) return null;

  const now = Date.now();
  const future = events.filter(e => new Date(e.dtstart).getTime() >= now);
  const past = events.filter(e => new Date(e.dtstart).getTime() < now);

  if (future.length > 0) {
    // nearest upcoming
    future.sort((a, b) => new Date(a.dtstart).getTime() - new Date(b.dtstart).getTime());
    return { ...future[0]!, isPast: false };
  }
  // most recent past
  past.sort((a, b) => new Date(b.dtstart).getTime() - new Date(a.dtstart).getTime());
  return past.length > 0 ? { ...past[0]!, isPast: true } : null;
}

type LoadState = 'loading' | 'loaded' | 'fallback';

export default function NextMeetup() {
  const { t, locale } = useTranslation();
  const [state, setState] = useState<LoadState>('loading');
  const [event, setEvent] = useState<MeetupEvent | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      // 1. try static JSON (CI-generated, no CORS issue)
      try {
        const res = await fetch(STATIC_DATA_URL);
        if (res.ok) {
          const data = (await res.json()) as Omit<MeetupEvent, 'isPast'>;
          if (!cancelled && data.summary && data.dtstart) {
            const isPast = new Date(data.dtstart).getTime() < Date.now();
            setEvent({ ...data, isPast });
            setState('loaded');
            return;
          }
        }
      } catch {
        // static file absent — continue to iCal attempt
      }

      // 2. try iCal feed (will fail with CORS in browser — handled below)
      try {
        const res = await fetch(MEETUP_ICAL, { mode: 'cors' });
        if (res.ok) {
          const text = await res.text();
          const parsed = parseIcal(text);
          if (!cancelled) {
            setEvent(parsed);
            setState(parsed ? 'loaded' : 'fallback');
          }
          return;
        }
      } catch {
        // CORS block or network failure — fall through to CTA
      }

      if (!cancelled) setState('fallback');
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const langTag = locale === 'mx' ? 'es-MX' : 'en-US';
  const formatDate = (iso: string) => {
    try {
      return new Intl.DateTimeFormat(langTag, {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        timeZoneName: 'short',
      }).format(new Date(iso));
    } catch {
      return iso;
    }
  };

  const header = <Header variant="h2">{t('feedPage.nextMeetupHeader')}</Header>;

  if (state === 'loading') {
    return (
      <Container header={header}>
        <Box color="text-status-inactive" fontSize="body-s">
          {t('feedPage.nextMeetupLoading')}
        </Box>
      </Container>
    );
  }

  if (state === 'fallback' || !event) {
    return (
      <Container header={header}>
        <SpaceBetween size="s">
          <Box color="text-body-secondary" fontSize="body-s">
            {t('feedPage.nextMeetupFallback')}
          </Box>
          <Button variant="link" href={MEETUP_GROUP_URL} target="_blank" iconAlign="right" iconName="external">
            {t('feedPage.nextMeetupCta')}
          </Button>
        </SpaceBetween>
      </Container>
    );
  }

  return (
    <Container header={header}>
      <SpaceBetween size="s">
        {event.isPast && (
          <Box color="text-status-inactive" fontSize="body-s">
            {t('feedPage.nextMeetupPastLabel')}
          </Box>
        )}
        <Box fontWeight="bold" fontSize="heading-m">
          {event.url ? (
            <Link href={event.url} external>
              {event.summary}
            </Link>
          ) : (
            event.summary
          )}
        </Box>
        <Box color="text-body-secondary" fontSize="body-s">
          {formatDate(event.dtstart)}
        </Box>
        {event.location && (
          <Box color="text-body-secondary" fontSize="body-s">
            {event.location}
          </Box>
        )}
        {event.description && (
          <Box color="text-body-secondary" fontSize="body-s">
            {event.description}
            {event.description.length >= MAX_DESCRIPTION_CHARS ? '…' : ''}
          </Box>
        )}
      </SpaceBetween>
    </Container>
  );
}

// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
import React, { useState } from 'react';

import Badge from '@cloudscape-design/components/badge';
import Box from '@cloudscape-design/components/box';
import Button from '@cloudscape-design/components/button';
import ContentLayout from '@cloudscape-design/components/content-layout';
import Header from '@cloudscape-design/components/header';
import Link from '@cloudscape-design/components/link';
import Select from '@cloudscape-design/components/select';
import SpaceBetween from '@cloudscape-design/components/space-between';
import Table from '@cloudscape-design/components/table';

import Navigation from '../../components/navigation';
import Breadcrumbs from '../../components/breadcrumbs';
import ShellLayout from '../../layouts/shell';

import generatedData from '../../data/releases.generated.json';
import type { TechCalendar, ReleaseEntry, ProjectedEntry, Confidence } from './types';
import { generateICS, generateICSForTech, downloadICS } from './utils/ical';

const allTechs = generatedData as TechCalendar[];

// ── helpers ──────────────────────────────────────────────────────────────────

function confidenceBadge(confidence: Confidence | string | undefined): React.ReactNode {
  if (!confidence) return null;
  const colorMap: Record<string, 'green' | 'blue' | 'grey' | 'red'> = {
    announced: 'green',
    high: 'blue',
    medium: 'grey',
    low: 'red',
    insufficient: 'red',
  };
  return <Badge color={colorMap[confidence] ?? 'grey'}>{confidence}</Badge>;
}

function dataSourceBadge(source: TechCalendar['dataSource']): React.ReactNode {
  const colorMap: Record<TechCalendar['dataSource'], 'green' | 'blue' | 'grey'> = {
    api: 'green',
    rss: 'blue',
    manual: 'grey',
  };
  return <Badge color={colorMap[source]}>{source}</Badge>;
}

function releaseCell(entry: ReleaseEntry | null): React.ReactNode {
  if (!entry) return '—';
  return (
    <SpaceBetween size="xxs" direction="vertical">
      <Box fontWeight="bold">{entry.version}</Box>
      <Box variant="small" color="text-body-secondary">{entry.date}</Box>
      {entry.releaseNotesUrl && (
        <Link href={entry.releaseNotesUrl} external fontSize="body-s">
          Release notes
        </Link>
      )}
    </SpaceBetween>
  );
}

function projectedCell(entry: ProjectedEntry | null): React.ReactNode {
  if (!entry) return '—';
  return (
    <SpaceBetween size="xxs" direction="vertical">
      <Box fontWeight="bold">{entry.projectedDate}</Box>
      {confidenceBadge(entry.confidence)}
      <Box variant="small" color="text-body-secondary">{entry.basedOn}</Box>
      {entry.sourceUrl && (
        <Link href={entry.sourceUrl} external fontSize="body-s">
          Source
        </Link>
      )}
    </SpaceBetween>
  );
}

// ── row type for the single-row table ────────────────────────────────────────

interface CalendarRow {
  id: string;
  mostRecentLTS: React.ReactNode;
  priorLTS: React.ReactNode;
  secondPriorLTS: React.ReactNode;
  mostRecentAny: React.ReactNode;
  projectedNextVersion: React.ReactNode;
  projectedNextLTS: React.ReactNode;
}

function techToRow(tech: TechCalendar): CalendarRow {
  return {
    id: tech.id,
    mostRecentLTS: releaseCell(tech.mostRecentLTS),
    priorLTS: releaseCell(tech.priorLTS),
    secondPriorLTS: releaseCell(tech.secondPriorLTS),
    mostRecentAny: releaseCell(tech.mostRecentAny),
    projectedNextVersion: projectedCell(tech.projectedNextVersion),
    projectedNextLTS: projectedCell(tech.projectedNextLTS),
  };
}

const TABLE_COLUMNS = [
  { id: 'mostRecentLTS', header: 'Most Recent LTS', cell: (r: CalendarRow) => r.mostRecentLTS },
  { id: 'priorLTS', header: 'Prior LTS', cell: (r: CalendarRow) => r.priorLTS },
  { id: 'secondPriorLTS', header: '2nd Prior LTS', cell: (r: CalendarRow) => r.secondPriorLTS },
  { id: 'mostRecentAny', header: 'Most Recent Release', cell: (r: CalendarRow) => r.mostRecentAny },
  { id: 'projectedNextVersion', header: 'Projected Next Release', cell: (r: CalendarRow) => r.projectedNextVersion },
  { id: 'projectedNextLTS', header: 'Projected Next LTS', cell: (r: CalendarRow) => r.projectedNextLTS },
];

// ── unique categories in seed-data order ────────────────────────────────────

const CATEGORY_ORDER = ['Language', 'Framework', 'AI Model', 'AWS Service', 'Tool', 'Standard'] as const;

function uniqueCategories(techs: TechCalendar[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const cat of CATEGORY_ORDER) {
    if (techs.some(t => t.category === cat)) {
      seen.add(cat);
      result.push(cat);
    }
  }
  // catch any category not in our static order
  for (const t of techs) {
    if (!seen.has(t.category)) {
      seen.add(t.category);
      result.push(t.category);
    }
  }
  return result;
}

// ── per-tech section ─────────────────────────────────────────────────────────

function TechSection({ tech }: { tech: TechCalendar }) {
  const handleExport = () => {
    const content = generateICSForTech(tech);
    downloadICS(`${tech.id}.ics`, content);
  };

  return (
    <section id={tech.id} style={{ marginBottom: '2rem' }}>
      <Table
        columnDefinitions={TABLE_COLUMNS}
        items={[techToRow(tech)]}
        variant="container"
        header={
          <Header
            variant="h2"
            actions={
              <SpaceBetween size="xs" direction="horizontal">
                {dataSourceBadge(tech.dataSource)}
                <Button onClick={handleExport} iconName="download">
                  Export (.ics)
                </Button>
              </SpaceBetween>
            }
          >
            <Link href={tech.sourceUrl} external>
              {tech.name}
            </Link>
          </Header>
        }
        empty={<Box>No data available</Box>}
      />
    </section>
  );
}

// ── main component ────────────────────────────────────────────────────────────

export default function MaintenanceCalendar() {
  const categories = uniqueCategories(allTechs);
  const categoryOptions = [
    { value: 'all', label: 'All categories' },
    ...categories.map(c => ({ value: c, label: c })),
  ];

  const [selectedCategory, setSelectedCategory] = useState<{ value: string; label: string }>(
    categoryOptions[0]
  );

  const visibleTechs =
    selectedCategory.value === 'all'
      ? allTechs
      : allTechs.filter(t => t.category === selectedCategory.value);

  const handleExportAll = () => {
    const content = generateICS(visibleTechs);
    const suffix = selectedCategory.value === 'all' ? 'all' : selectedCategory.value.toLowerCase().replace(/\s+/g, '-');
    downloadICS(`maintenance-calendar-${suffix}.ics`, content);
  };

  return (
    <ShellLayout
      contentType="default"
      breadcrumbs={<Breadcrumbs active={{ text: 'Maintenance Calendar', href: '/maintenance-calendar/' }} />}
      navigation={<Navigation />}
    >
      <ContentLayout
        header={
          <Header
            variant="h1"
            description="Release cadence tracker for 23 technologies — LTS history, recent releases, and projected dates."
            actions={
              <SpaceBetween size="xs" direction="horizontal">
                <Select
                  selectedOption={selectedCategory}
                  onChange={({ detail }) =>
                    setSelectedCategory(detail.selectedOption as { value: string; label: string })
                  }
                  options={categoryOptions}
                  ariaLabel="Filter by category"
                />
                <Button onClick={handleExportAll} iconName="download" variant="primary">
                  Export All (.ics)
                </Button>
              </SpaceBetween>
            }
          >
            Maintenance Calendar
          </Header>
        }
      >
        <SpaceBetween size="l">
          {visibleTechs.map(tech => (
            <TechSection key={tech.id} tech={tech} />
          ))}
        </SpaceBetween>
      </ContentLayout>
    </ShellLayout>
  );
}

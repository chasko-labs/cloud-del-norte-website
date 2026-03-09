import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { TechCalendar } from '../../types';
import { generateICS, generateICSForTech, downloadICS } from '../ical';

function makeTech(overrides: Partial<TechCalendar> = {}): TechCalendar {
  return {
    id: 'test-tech',
    name: 'Test Tech',
    category: 'Tool',
    dataSource: 'manual',
    sourceUrl: 'https://example.com/releases',
    mostRecentLTS: null,
    mostRecentAny: null,
    projectedNextVersion: null,
    projectedNextLTS: null,
    priorLTS: null,
    secondPriorLTS: null,
    ...overrides,
  };
}

const projected = (projectedDate: string, basedOn = 'historical cadence') => ({
  projectedDate,
  confidence: 'medium' as const,
  basedOn,
});

describe('iCal export utility', () => {
  describe('generateICS', () => {
    it('produces valid VCALENDAR structure with no VEVENTs when no projected dates', () => {
      const tech = makeTech();
      const output = generateICS([tech]);
      expect(output).toContain('BEGIN:VCALENDAR');
      expect(output).toContain('END:VCALENDAR');
      expect(output).not.toContain('BEGIN:VEVENT');
    });

    it('starts with BEGIN:VCALENDAR and ends with END:VCALENDAR', () => {
      const output = generateICS([]);
      expect(output.startsWith('BEGIN:VCALENDAR')).toBe(true);
      expect(output.endsWith('END:VCALENDAR')).toBe(true);
    });

    it('produces one VEVENT when tech has only projectedNextVersion', () => {
      const tech = makeTech({ projectedNextVersion: projected('2025-09-15') });
      const output = generateICS([tech]);
      const matches = output.match(/BEGIN:VEVENT/g);
      expect(matches).toHaveLength(1);
    });

    it('produces two VEVENTs when tech has both projectedNextVersion and projectedNextLTS', () => {
      const tech = makeTech({
        projectedNextVersion: projected('2025-09-15'),
        projectedNextLTS: projected('2026-03-01'),
      });
      const output = generateICS([tech]);
      const matches = output.match(/BEGIN:VEVENT/g);
      expect(matches).toHaveLength(2);
    });

    it('includes events from all techs when given multiple', () => {
      const tech1 = makeTech({ id: 'alpha', name: 'Alpha', projectedNextVersion: projected('2025-09-15') });
      const tech2 = makeTech({ id: 'beta', name: 'Beta', projectedNextVersion: projected('2025-10-01') });
      const output = generateICS([tech1, tech2]);
      expect(output.match(/BEGIN:VEVENT/g)).toHaveLength(2);
      expect(output).toContain('alpha-next-release@awsug-cloudnorte');
      expect(output).toContain('beta-next-release@awsug-cloudnorte');
    });

    it('formats DTSTART as YYYYMMDD with no dashes and VALUE=DATE attribute', () => {
      const tech = makeTech({ projectedNextVersion: projected('2025-09-15') });
      const output = generateICS([tech]);
      expect(output).toContain('DTSTART;VALUE=DATE:20250915');
    });

    it('uses CRLF line endings throughout (RFC 5545)', () => {
      const tech = makeTech({ projectedNextVersion: projected('2025-09-15') });
      const output = generateICS([tech]);
      // All line separators should be \r\n
      const linesWithBareNewline = output.split('\n').filter(line => line.endsWith('\r'));
      // Every \n should be preceded by \r
      expect(output).not.toMatch(/(?<!\r)\n/);
      expect(linesWithBareNewline.length).toBeGreaterThan(0);
    });

    it('escapes commas in tech name per RFC 5545 sanitization', () => {
      const tech = makeTech({ name: 'Node, JS', projectedNextVersion: projected('2025-09-15') });
      const output = generateICS([tech]);
      expect(output).toContain('Node\\, JS');
    });

    it('escapes semicolons in tech name per RFC 5545 sanitization', () => {
      const tech = makeTech({ name: 'A;B', projectedNextVersion: projected('2025-09-15') });
      const output = generateICS([tech]);
      expect(output).toContain('A\\;B');
    });

    it('uses unique UIDs per tech+event-type combination', () => {
      const tech1 = makeTech({ id: 'foo', projectedNextVersion: projected('2025-09-15') });
      const tech2 = makeTech({ id: 'bar', projectedNextVersion: projected('2025-10-01') });
      const output = generateICS([tech1, tech2]);
      expect(output).toContain('UID:foo-next-release@awsug-cloudnorte');
      expect(output).toContain('UID:bar-next-release@awsug-cloudnorte');
    });

    it('includes SUMMARY with tech name and event type', () => {
      const tech = makeTech({ name: 'Python', projectedNextVersion: projected('2025-09-15') });
      const output = generateICS([tech]);
      expect(output).toContain('SUMMARY:Python: Projected Next Release');
    });

    it('includes DESCRIPTION from basedOn field', () => {
      const tech = makeTech({ projectedNextVersion: projected('2025-09-15', 'annual release pattern') });
      const output = generateICS([tech]);
      expect(output).toContain('DESCRIPTION:annual release pattern');
    });

    it('includes URL from sourceUrl when present', () => {
      const tech = makeTech({
        sourceUrl: 'https://example.com/releases',
        projectedNextVersion: projected('2025-09-15'),
      });
      const output = generateICS([tech]);
      expect(output).toContain('URL:https://example.com/releases');
    });
  });

  describe('generateICSForTech', () => {
    it('is equivalent to generateICS([tech])', () => {
      const tech = makeTech({
        id: 'python',
        name: 'Python',
        projectedNextVersion: projected('2025-09-15'),
        projectedNextLTS: projected('2026-03-01'),
      });
      expect(generateICSForTech(tech)).toBe(generateICS([tech]));
    });
  });

  describe('downloadICS', () => {
    let mockAnchor: { href: string; download: string; click: ReturnType<typeof vi.fn> };

    beforeEach(() => {
      vi.stubGlobal('URL', {
        createObjectURL: vi.fn().mockReturnValue('blob:mock-url'),
        revokeObjectURL: vi.fn(),
      });

      mockAnchor = { href: '', download: '', click: vi.fn() };
      vi.spyOn(document, 'createElement').mockReturnValue(mockAnchor as unknown as HTMLElement);
    });

    it('calls click on the anchor element', () => {
      downloadICS('test.ics', 'BEGIN:VCALENDAR\r\nEND:VCALENDAR');
      expect(mockAnchor.click).toHaveBeenCalledOnce();
    });

    it('revokes the object URL after clicking', () => {
      downloadICS('test.ics', 'BEGIN:VCALENDAR\r\nEND:VCALENDAR');
      expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock-url');
    });

    it('sets correct filename on the anchor', () => {
      downloadICS('my-calendar.ics', 'BEGIN:VCALENDAR\r\nEND:VCALENDAR');
      expect(mockAnchor.download).toBe('my-calendar.ics');
    });
  });
});

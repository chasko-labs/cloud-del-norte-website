import { describe, it } from 'vitest';

describe('iCal export utility', () => {
  it.todo('output is valid .ics format (begins with BEGIN:VCALENDAR, ends with END:VCALENDAR)');
  it.todo('DTSTART uses correct ISO 8601 / iCal date format (YYYYMMDD or YYYYMMDDTHHMMSSZ)');
  it.todo('null projected dates are omitted (no event created for missing data)');
  it.todo('single tech export contains only that tech\'s events');
  it.todo('Export All concatenates events from all techs without duplication');
  it.todo('SUMMARY field contains tech name + version string');
  it.todo('DESCRIPTION field contains release notes URL');
});

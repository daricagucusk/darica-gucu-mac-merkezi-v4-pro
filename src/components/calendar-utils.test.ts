import { describe, expect, it } from 'vitest';
import { buildIcs, googleCalendarUrl } from './calendar-utils';
import { kickoffToEpoch } from '../media/countdown';

describe('calendar-utils', () => {
  const start = kickoffToEpoch({ date: '2026-11-09', time: '18:00' }) as number;
  const event = { uid: 'a|b', summary: 'U12: A - B', startEpoch: start, location: 'Saha 1, Darıca', description: 'Satır1\nSatır2' };

  it('İstanbul duvar saatini UTC yazar (18:00 +03 -> 15:00Z)', () => {
    const ics = buildIcs([event], new Date('2026-11-01T00:00:00Z'));
    expect(ics).toContain('DTSTART:20261109T150000Z');
    expect(ics).toContain('DTEND:20261109T163000Z');
    expect(ics).toContain('TRIGGER:-PT2H');
    expect(ics).toContain('LOCATION:Saha 1\\, Darıca');
    expect(ics).toContain('\r\nEND:VCALENDAR\r\n');
  });

  it('Google Takvim bağlantısı aynı UTC aralığını taşır', () => {
    const url = googleCalendarUrl(event);
    expect(decodeURIComponent(url)).toContain('dates=20261109T150000Z/20261109T163000Z');
  });
});

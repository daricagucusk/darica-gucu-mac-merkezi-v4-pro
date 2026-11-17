// Takvim (.ics / Google Takvim) üretimi: istemci tarafı, bağımlılık yok.
// ASKF programında bitiş saati yoktur; varsayılan süre 90 dakikadır (varsayım, arayüzde belirtilmez).
export const DEFAULT_DURATION_MIN = 90;

export interface CalendarEvent {
  uid: string;
  summary: string;
  startEpoch: number;
  durationMin?: number;
  location?: string;
  description?: string;
}

function utcStamp(epoch: number): string {
  return new Date(epoch).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

function escapeText(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
}

function fold(line: string): string {
  const chunks: string[] = [];
  let rest = line;
  while (rest.length > 73) { chunks.push(rest.slice(0, 73)); rest = ` ${rest.slice(73)}`; }
  chunks.push(rest);
  return chunks.join('\r\n');
}

/** RFC 5545 takvimi; başlangıç UTC yazılır (VTIMEZONE gerekmez), maçtan 2 saat önce hatırlatıcı eklenir. */
export function buildIcs(events: CalendarEvent[], now: Date = new Date()): string {
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Darica Gucu//Mac Merkezi//TR', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH'];
  for (const event of events) {
    const end = event.startEpoch + (event.durationMin ?? DEFAULT_DURATION_MIN) * 60_000;
    lines.push(
      'BEGIN:VEVENT',
      `UID:${event.uid.replace(/[^A-Za-z0-9|.@-]/g, '-')}@darica-gucu`,
      `DTSTAMP:${utcStamp(now.getTime())}`,
      `DTSTART:${utcStamp(event.startEpoch)}`,
      `DTEND:${utcStamp(end)}`,
      `SUMMARY:${escapeText(event.summary)}`,
    );
    if (event.location) lines.push(`LOCATION:${escapeText(event.location)}`);
    if (event.description) lines.push(`DESCRIPTION:${escapeText(event.description)}`);
    lines.push('BEGIN:VALARM', 'ACTION:DISPLAY', 'DESCRIPTION:Maç hatırlatması', 'TRIGGER:-PT2H', 'END:VALARM', 'END:VEVENT');
  }
  lines.push('END:VCALENDAR');
  return `${lines.map(fold).join('\r\n')}\r\n`;
}

export function googleCalendarUrl(event: CalendarEvent): string {
  const end = event.startEpoch + (event.durationMin ?? DEFAULT_DURATION_MIN) * 60_000;
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: event.summary,
    dates: `${utcStamp(event.startEpoch)}/${utcStamp(end)}`,
  });
  if (event.location) params.set('location', event.location);
  if (event.description) params.set('details', event.description);
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

export function downloadIcs(filename: string, ics: string): void {
  const url = URL.createObjectURL(new Blob([ics], { type: 'text/calendar;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

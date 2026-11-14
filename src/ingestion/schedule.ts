export interface AskfMonitorSettings {
  frequency: 'daily' | 'weekly';
  weekday: 2;
  hour: 18;
  timeZone: 'Europe/Istanbul';
}

export const defaultAskfMonitorSettings: AskfMonitorSettings = {
  frequency: 'weekly',
  weekday: 2,
  hour: 18,
  timeZone: 'Europe/Istanbul',
};

export function shouldRunScheduledCheck(
  settings: AskfMonitorSettings,
  now: Date,
): boolean {
  if (settings.frequency === 'daily') return true;
  const weekday = new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    timeZone: settings.timeZone,
  }).format(now);
  return weekday === 'Tue';
}

export function describeAskfSchedule(settings: AskfMonitorSettings): string {
  return settings.frequency === 'daily'
    ? 'Her gün saat 18:00 (Türkiye saati)'
    : 'Her Salı saat 18:00 (Türkiye saati)';
}

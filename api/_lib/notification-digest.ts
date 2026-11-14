import { PATH_LIVE, readJSON } from './blob-store.js';
import type { PublishedSnapshot } from '../../src/ingestion/publish.js';
import { buildMatchReminderKey, shouldRemindFixture } from '../../src/notifications/logic.js';
import { createNotification } from './notifications.js';

function istanbulDay(date: Date): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Istanbul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

export async function notifyPendingAskfReview(snapshot: PublishedSnapshot): Promise<void> {
  await createNotification({
    type: 'askf_pending_review',
    title: 'Yeni ASKF programı indirildi',
    body: `${snapshot.sourceFile} · ${snapshot.daricaMatches.length} Darıca Gücü karşılaşması. Canlı fikstüre eklemek için incelemen gerekiyor.`,
    href: 'source',
    dedupeKey: `askf-pending:${snapshot.sourceHash}`,
  });
}

export async function notifyAskfReviewResult(
  action: 'approved' | 'rejected',
  snapshot: PublishedSnapshot,
): Promise<void> {
  await createNotification({
    type: action === 'approved' ? 'askf_approved' : 'askf_rejected',
    title: action === 'approved' ? 'ASKF programı onaylandı' : 'ASKF programı reddedildi',
    body: action === 'approved'
      ? `${snapshot.sourceFile} canlı maç takvimine aktarıldı.`
      : `${snapshot.sourceFile} reddedildi. Canlı maç takvimi değiştirilmedi.`,
    href: action === 'approved' ? 'matches' : 'source',
    dedupeKey: `askf-review:${action}:${snapshot.sourceHash}`,
  });
}

export async function notifyAskfSourceIssue(now = new Date()): Promise<void> {
  await createNotification({
    type: 'source_issue',
    title: 'ASKF program kontrolü başarısız',
    body: 'Resmî kaynak şu an indirilemedi veya doğrulanamadı. Son doğrulanmış program korunuyor.',
    href: 'source',
    dedupeKey: `askf-source-issue:${istanbulDay(now)}`,
  });
}

export async function dispatchDailyFixtureReminders(now = new Date()): Promise<{ created: number; checked: number }> {
  const snapshot = await readJSON<PublishedSnapshot>(PATH_LIVE);
  if (!snapshot) return { created: 0, checked: 0 };

  let created = 0;
  let checked = 0;
  for (const fixture of snapshot.daricaMatches) {
    if (!shouldRemindFixture(fixture.status, fixture.date, fixture.time, now, 30)) continue;
    checked += 1;
    const result = await createNotification({
      type: 'match_reminder',
      title: `${fixture.group} · maç hatırlatması`,
      body: `${fixture.home} – ${fixture.away} · ${fixture.date} · ${fixture.time} · ${fixture.venue}`,
      href: 'matches',
      dedupeKey: buildMatchReminderKey({
        season: snapshot.season,
        fixtureId: fixture.id,
        date: fixture.date,
        time: fixture.time,
      }),
    });
    if (result.created) created += 1;
  }
  return { created, checked };
}

import { describe, expect, it } from 'vitest';
import { POSTER_CATALOG, layoutPosterTemplate, type PosterTemplateRequest } from './poster-catalog';
import {
  SHORTS_THEMES, layoutFeedPoster, layoutShortsCover, layoutStoryA, layoutStoryC,
  type PosterLayout, type ShortsThemeId, type StoryAInput,
} from './poster-layouts';
import { ellipsize, fitText, trUpper, wrapText, type Measure, type TextItem } from './poster-text';
import { buildPosterCopy, type PosterFixture } from './poster-utils';

// Gerçek canvas yok: kasıtlı olarak geniş tahmin (Chivo 900 büyük harfleri ~0.7em).
const measure: Measure = (text, font) => {
  const size = Number(/(\d+(?:\.\d+)?)px/.exec(font)?.[1] ?? 16);
  return Array.from(text).length * size * 0.75;
};

const LONG = 'Çok Uzun Takım Adı Gençlik ve Spor Kulübü Derneği Anadolu';
const TR = 'ığüşöçi İstanbul';

const texts = (layout: PosterLayout): TextItem[] =>
  layout.items.filter((item): item is TextItem => item.kind === 'text');
const roles = (layout: PosterLayout): string[] => layout.items.map((item) => item.role);

function expectInsideSafeArea(layout: PosterLayout): void {
  for (const item of texts(layout)) {
    const { x, y, w, h } = item.box;
    expect(x, `${item.role} sol`).toBeGreaterThanOrEqual(0);
    expect(x + w, `${item.role} sağ`).toBeLessThanOrEqual(layout.width);
    expect(y, `${item.role} üst`).toBeGreaterThanOrEqual(0);
    expect(y + h, `${item.role} alt`).toBeLessThanOrEqual(layout.height);
    expect(w, `${item.role} maxWidth`).toBeLessThanOrEqual(item.maxWidth + 0.001);
    if (item.critical) {
      expect(y, `${item.role} güvenli üst`).toBeGreaterThanOrEqual(layout.safe.top);
      expect(y + h, `${item.role} güvenli alt`).toBeLessThanOrEqual(layout.height - layout.safe.bottom);
    }
  }
}

const storyA: StoryAInput = {
  group: 'U14 12. Grup', home: 'Darıca Gücü SK', away: 'Çayırova Serhat Spor',
  date: '21 Kasım 2026', time: '14:30', venue: 'Darıca Nenehatun Stadı',
};

const fixture: PosterFixture = {
  id: 'f1', group: 'U14', date: '2026-11-21', time: '14:30', home: 'Darıca Gücü SK', away: 'Gebze Spor',
  venue: 'Darıca Nenehatun Stadı', status: 'scheduled', homeScore: 3, awayScore: 1,
};

function feedRequests(overrides: Partial<PosterFixture> = {}, sponsors?: string[]): PosterTemplateRequest[] {
  const f = { ...fixture, ...overrides };
  const mk = (template: 'matchday' | 'weekly-program' | 'result' | 'announcement') =>
    buildPosterCopy({ template, fixture: f, fixtures: [f, f, f, f, f, f, f], verified: true, title: 'Duyuru Başlığı', subtitle: 'Alt başlık' });
  return [
    { id: 'matchday-45', input: { copy: mk('matchday'), sponsors } },
    { id: 'weekly-program-45', input: { copy: mk('weekly-program'), sponsors } },
    { id: 'result-45', input: { copy: mk('result'), sponsors } },
    { id: 'announcement-45', input: { copy: mk('announcement'), sponsors } },
  ];
}

describe('metin yardımcıları', () => {
  it('Türkçe büyük harf: i->İ, ı->I', () => {
    expect(trUpper('istanbul ığdır')).toBe('İSTANBUL IĞDIR');
  });

  it('ellipsize ve fitText sığdırır', () => {
    const font = '900 40px Chivo, sans-serif';
    expect(measure(ellipsize('A'.repeat(80), font, 300, measure), font)).toBeLessThanOrEqual(300);
    expect(ellipsize('A'.repeat(80), font, 300, measure).endsWith('…')).toBe(true);
    const item = fitText({ role: 'x', text: LONG, x: 540, y: 100, maxWidth: 400, size: 60, weight: 900, color: '#fff' }, measure);
    expect(item.box.w).toBeLessThanOrEqual(400);
  });

  it('wrapText maxLines aşılırsa son satır kısaltılır', () => {
    const lines = wrapText({ role: 'x', text: LONG.repeat(3), x: 0, y: 0, maxWidth: 400, size: 40, weight: 900, color: '#fff', lineHeight: 50, maxLines: 2 }, measure);
    expect(lines).toHaveLength(2);
    expect(lines[1].text.endsWith('…')).toBe(true);
    expect(lines.every((l) => l.box.w <= 400)).toBe(true);
  });
});

describe('Shorts / Reels kapak', () => {
  const base = { hook: 'Nefes kesen derbi', badge: 'MAÇ ÖZETİ', home: 'Darıca Gücü SK', away: 'Gebze Spor' };

  it('1080x1920, güvenli alan (üst 288 / alt 384) içinde', () => {
    for (const theme of Object.keys(SHORTS_THEMES) as ShortsThemeId[]) {
      const layout = layoutShortsCover({ ...base, theme, subtitle: 'U14' }, measure);
      expect([layout.width, layout.height]).toEqual([1080, 1920]);
      expect(layout.safe.top).toBeGreaterThanOrEqual(250);
      expect(layout.safe.bottom).toBeGreaterThanOrEqual(250);
      expectInsideSafeArea(layout);
    }
  });

  it('yalnız 2 tema (YouTube Kırmızı, Darıca Zümrüt); başka platform teması yok; farklı ana renk, referans hex ile eşleşir', () => {
    expect(Object.keys(SHORTS_THEMES).sort()).toEqual(['club-emerald', 'youtube-red']);
    // Kaynak: prototip-index.txt renderShortsCover (badgeColor ve gradyan durakları).
    const expected: Record<ShortsThemeId, { accent: string; mid: string }> = {
      'youtube-red': { accent: '#ef4444', mid: '#850d0d' },
      'club-emerald': { accent: '#10b981', mid: '#0a422b' },
    };
    const accents = new Set<string>();
    for (const theme of Object.keys(expected) as ShortsThemeId[]) {
      const layout = layoutShortsCover({ ...base, theme }, measure);
      const bg = layout.items.find((i) => i.kind === 'bg');
      const chip = layout.items.find((i) => i.role === 'vs-chip');
      expect(bg && bg.kind === 'bg' && bg.stops[1][1]).toBe(expected[theme].mid);
      expect(chip && chip.kind === 'rect' && chip.fill).toBe(expected[theme].accent);
      accents.add(expected[theme].accent);
    }
    expect(accents.size).toBe(2);
  });

  it('skor/sahte sayı yok; ğüşöçıİ büyütme doğru; uzun ad taşmaz', () => {
    const layout = layoutShortsCover({ ...base, theme: 'youtube-red', home: TR, away: LONG, hook: LONG + LONG }, measure);
    expect(roles(layout)).not.toContain('score');
    expect(texts(layout).some((t) => /\d\s*[-—]\s*\d/.test(t.text))).toBe(false);
    expect(texts(layout).find((t) => t.role === 'home')?.text).toBe('IĞÜŞÖÇİ İSTANBUL');
    expectInsideSafeArea(layout);
  });

  it('sponsor listesi boşken şerit yok, doluyken var', () => {
    for (const sponsors of [undefined, [], ['  ']]) {
      expect(roles(layoutShortsCover({ ...base, theme: 'club-emerald', sponsors }, measure))).not.toContain('sponsor-strip');
    }
    const withS = layoutShortsCover({ ...base, theme: 'club-emerald', sponsors: ['Kanatçı Nizam', 'Doğanay Raf'] }, measure);
    expect(roles(withS)).toContain('sponsor-strip');
    expect(texts(withS).filter((t) => t.role === 'sponsor-name').map((t) => t.text)).toEqual(['KANATÇI NİZAM', 'DOĞANAY RAF']);
    expectInsideSafeArea(withS);
  });
});

describe('Hikaye A', () => {
  it('1080x1920 ve güvenli alan içinde, tam girdiyle', () => {
    const layout = layoutStoryA({
      ...storyA, countdown: { days: 2, hours: 4, minutes: 5 },
      weather: { tempC: 12.4, label: 'Parçalı bulutlu', source: 'Open-Meteo' }, sponsors: ['A', 'B'],
    }, measure);
    expect([layout.width, layout.height]).toEqual([1080, 1920]);
    expectInsideSafeArea(layout);
    const all = texts(layout).map((t) => t.text);
    expect(all).toContain('02');
    expect(all).toContain('04');
    expect(all).toContain('05');
    expect(all.some((t) => t.startsWith('12°C'))).toBe(true);
    expect(all).toContain('Kaynak: Open-Meteo');
  });

  it('weather/countdown null veya undefined iken bölümler çizilmez, yer tutucu yok', () => {
    for (const extra of [{}, { countdown: null, weather: null }]) {
      const layout = layoutStoryA({ ...storyA, ...extra }, measure);
      expect(roles(layout).filter((r) => r.startsWith('weather') || r.startsWith('countdown'))).toEqual([]);
      expect(texts(layout).some((t) => /°C|^GÜN$|^SAAT$|^DAKİKA$|BAŞLAMAYA/.test(t.text))).toBe(false);
      expectInsideSafeArea(layout);
    }
  });

  it('Türkçe karakter ve 40+ karakter takım adı', () => {
    const layout = layoutStoryA({ ...storyA, home: TR, away: LONG, venue: LONG + LONG, group: LONG }, measure);
    expect(texts(layout).find((t) => t.role === 'home')?.text).toBe('IĞÜŞÖÇİ İSTANBUL');
    expect(LONG.length).toBeGreaterThan(40);
    expectInsideSafeArea(layout);
  });

  it('sponsor şeridi yalnız liste doluyken', () => {
    expect(roles(layoutStoryA(storyA, measure))).not.toContain('sponsor-strip');
    expect(roles(layoutStoryA({ ...storyA, sponsors: [] }, measure))).not.toContain('sponsor-strip');
  });
});

describe('Hikaye C', () => {
  const mvp = { name: 'Test Oyuncu', number: 8, position: 'Orta saha' };

  it('1080x1920; skor yokken skor öğesi yok', () => {
    const layout = layoutStoryC({ home: 'Darıca Gücü SK', away: 'Gebze Spor', mvp }, measure);
    expect([layout.width, layout.height]).toEqual([1080, 1920]);
    expect(roles(layout)).not.toContain('score');
    expect(roles(layout)).not.toContain('result-label');
    expect(texts(layout).some((t) => /\d\s*[—-]\s*\d/.test(t.text))).toBe(false);
    expectInsideSafeArea(layout);
  });

  it('skor girilince yalnız girilen değer çizilir', () => {
    const layout = layoutStoryC({ home: 'A', away: 'B', score: { home: 2, away: 0 }, mvp }, measure);
    expect(texts(layout).find((t) => t.role === 'score')?.text).toBe('2 — 0');
    expectInsideSafeArea(layout);
  });

  it('foto yoksa forma no avatarı, varsa daire foto', () => {
    const noPhoto = layoutStoryC({ home: 'A', away: 'B', mvp }, measure);
    expect(roles(noPhoto)).toContain('mvp-avatar');
    expect(texts(noPhoto).find((t) => t.role === 'mvp-avatar-number')?.text).toBe('8');
    expect(roles(noPhoto)).not.toContain('mvp-photo');
    const withPhoto = layoutStoryC({ home: 'A', away: 'B', mvp: { ...mvp, photo: {} as CanvasImageSource } }, measure);
    expect(roles(withPhoto)).toContain('mvp-photo');
    expect(roles(withPhoto)).not.toContain('mvp-avatar');
  });

  it('mvp yoksa kart yok; uzun/Türkçe adlar taşmaz', () => {
    expect(roles(layoutStoryC({ home: 'A', away: 'B' }, measure))).not.toContain('mvp-card');
    const layout = layoutStoryC({
      home: TR, away: LONG, score: { home: 10, away: 12 }, group: LONG,
      mvp: { name: 'Şükrü Çağlar Öztürk-Gündoğdu Ihlamuroğlu İbrahim', number: 10, position: LONG },
    }, measure);
    expectInsideSafeArea(layout);
    expect(texts(layout).find((t) => t.role === 'mvp-name')?.text.startsWith('ŞÜKRÜ ÇAĞLAR')).toBe(true);
  });
});

describe('4:5 şablonlar (maç günü, haftalık program, sonuç, duyuru)', () => {
  it('1080x1350 ve tuval içinde; sponsorsuz şerit yok', () => {
    for (const request of feedRequests()) {
      const layout = layoutPosterTemplate(request, measure);
      expect([layout.width, layout.height], request.id).toEqual([1080, 1350]);
      expectInsideSafeArea(layout);
      expect(roles(layout), request.id).not.toContain('sponsor-strip');
    }
  });

  it('sponsor listesi doluyken şerit var ve taşmaz', () => {
    const sponsors = ['Darıca Belediyesi', 'Kocaeli ASKF', LONG, LONG];
    for (const request of feedRequests({}, sponsors)) {
      const layout = layoutPosterTemplate(request, measure);
      expect(roles(layout), request.id).toContain('sponsor-strip');
      expectInsideSafeArea(layout);
    }
  });

  it('skor yalnız sonuç şablonunda ve girilen değerle', () => {
    const [matchday, weekly, result, announcement] = feedRequests().map((r) => layoutPosterTemplate(r, measure));
    for (const layout of [matchday, weekly, announcement]) expect(roles(layout)).not.toContain('score');
    expect(texts(result).find((t) => t.role === 'score')?.text).toBe('3  —  1');
  });

  it('ğüşöçıİ ve 40+ karakterli takım adı: dönüşüm doğru, taşma yok', () => {
    for (const request of feedRequests({ home: TR, away: LONG, venue: LONG, group: LONG })) {
      const layout = layoutPosterTemplate(request, measure);
      expectInsideSafeArea(layout);
    }
    const matchday = layoutPosterTemplate(feedRequests({ home: TR, away: LONG })[0], measure);
    expect(texts(matchday).filter((t) => t.role === 'team')[0].text).toBe('IĞÜŞÖÇİ İSTANBUL');
  });

  it('story ve square biçimleri de aynı motordan güvenli alan içinde çıkar', () => {
    const f = { ...fixture, away: LONG };
    for (const format of ['story', 'square'] as const) {
      for (const template of ['matchday', 'weekly-program', 'result', 'announcement'] as const) {
        const copy = buildPosterCopy({ template, fixture: f, fixtures: [f, f, f, f, f, f, f], verified: true });
        const layout = layoutFeedPoster({ format, template, copy, sponsors: ['A', 'B'] }, measure);
        expect(layout.height).toBe(format === 'story' ? 1920 : 1080);
        expectInsideSafeArea(layout);
      }
    }
  });
});

describe('katalog', () => {
  it('7 şablon, doğru boyutlar, 2 Shorts teması', () => {
    expect(POSTER_CATALOG.map((e) => e.id)).toEqual([
      'shorts-cover', 'story-a', 'story-c', 'matchday-45', 'weekly-program-45', 'result-45', 'announcement-45',
    ]);
    for (const entry of POSTER_CATALOG) {
      expect(entry.width).toBe(1080);
      expect(entry.height).toBe(entry.aspect === '9:16' ? 1920 : 1350);
    }
    expect(POSTER_CATALOG[0].themes?.map((t) => t.id)).toEqual(['youtube-red', 'club-emerald']);
    expect(POSTER_CATALOG[0].name).toBe('Shorts / Reels Kapak');
  });
});

describe('sponsor şeridi: logolar ve ad geri dönüşü', () => {
  const logo = { width: 230, height: 256 } as unknown as CanvasImageSource;
  const wide = { width: 197, height: 70 } as unknown as CanvasImageSource;
  const sponsors = [
    { name: 'Arapçeşme Diş', sub: '@arapcesmedis', logo: wide },
    { name: 'Kanatçı Nizam', sub: '@kanatcinizam', logo },
    { name: 'Doğanay Raf', sub: 'Forma Sponsoru' },
  ];
  const imgs = (l: PosterLayout) => l.items.filter((i) => i.kind === 'image' && i.role === 'sponsor-logo');
  const names = (l: PosterLayout) => texts(l).filter((t) => t.role === 'sponsor-name').map((t) => t.text);

  it('logolu sponsor için logo görseli + ad; logosuz için yalnız ad rozeti', () => {
    const l = layoutStoryA({ ...storyA, sponsors }, measure);
    expect(imgs(l)).toHaveLength(2);
    expect(names(l)).toEqual(['ARAPÇEŞME DİŞ', 'KANATÇI NİZAM', 'DOĞANAY RAF']);
    expect(texts(l).filter((t) => t.role === 'sponsor-sub').map((t) => t.text)).toEqual(['@arapcesmedis', '@kanatcinizam', 'FORMA SPONSORU']);
    expectInsideSafeArea(l);
  });

  it('logo yüklenemezse (null) görsel yerine sponsor adı yazı rozeti çizilir', () => {
    const failed = sponsors.map((s) => ({ ...s, logo: null }));
    const l = layoutStoryA({ ...storyA, sponsors: failed }, measure);
    expect(imgs(l)).toHaveLength(0);
    expect(names(l)).toHaveLength(3);
    expect(names(l)[1]).toBe('KANATÇI NİZAM');
  });

  it('tüm şablonlarda şerit taşmaz ve boş liste şerit üretmez', () => {
    for (const request of feedRequests({}, undefined).map((r) => ({ ...r, input: { ...r.input, sponsors } }) as PosterTemplateRequest)) {
      const l = layoutPosterTemplate(request, measure);
      expect(roles(l), request.id).toContain('sponsor-strip');
      expectInsideSafeArea(l);
    }
    expect(roles(layoutStoryC({ home: 'A', away: 'B', sponsors: [] }, measure))).not.toContain('sponsor-strip');
    expect(roles(layoutShortsCover({ hook: 'x', badge: 'y', home: 'A', away: 'B', theme: 'youtube-red', sponsors }, measure))).toContain('sponsor-strip');
  });

  it('4:5 maç günü: şerit, davet hapı ve alt bilgiyle çakışmaz', () => {
    const l = layoutPosterTemplate(feedRequests({}, undefined).map((r) => ({ ...r, input: { ...r.input, sponsors } }) as PosterTemplateRequest)[0], measure);
    const strip = l.items.find((i) => i.role === 'sponsor-strip');
    const pill = l.items.find((i) => i.role === 'invite-pill');
    const footer = texts(l).find((t) => t.role === 'footer-left');
    if (!strip || strip.kind !== 'rect' || !pill || pill.kind !== 'rect' || !footer) throw new Error('öğe eksik');
    expect(pill.y + pill.h).toBeLessThanOrEqual(strip.y);
    expect(strip.y + strip.h).toBeLessThanOrEqual(footer.box.y);
  });
});

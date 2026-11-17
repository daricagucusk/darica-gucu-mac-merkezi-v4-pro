import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { shouldShowIosInstallHint } from './install';

const IOS_SAFARI = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';
const IOS_CHROME = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/130.0 Mobile/15E148 Safari/604.1';
const ANDROID = 'Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36';

describe('iOS ana ekrana ekle yönlendirmesi', () => {
  it('yalnızca tarayıcı sekmesindeki iOS Safari için gösterilir', () => {
    expect(shouldShowIosInstallHint(IOS_SAFARI, false)).toBe(true);
    expect(shouldShowIosInstallHint(IOS_SAFARI, true)).toBe(false);
    expect(shouldShowIosInstallHint(IOS_CHROME, false)).toBe(false);
    expect(shouldShowIosInstallHint(ANDROID, false)).toBe(false);
  });
});

function loadPolicy(origin = 'https://v4.example.com') {
  const source = readFileSync(new URL('../../public/sw.js', import.meta.url), 'utf8');
  const g = globalThis as unknown as { __SW_TEST__?: { cachePolicy?: (u: URL, r: { method: string; mode?: string }) => string } };
  g.__SW_TEST__ = {};
  const fakeSelf = { location: { origin }, addEventListener: () => undefined };
  new Function('self', source)(fakeSelf);
  const policy = g.__SW_TEST__!.cachePolicy!;
  delete g.__SW_TEST__;
  return policy;
}

describe('service worker önbellek politikası', () => {
  const policy = loadPolicy();
  const get = (path: string, mode = 'cors') => policy(new URL(`https://v4.example.com${path}`), { method: 'GET', mode });

  it('gezinmeyi uygulama kabuğuna, hash\'li dosyaları kalıcı önbelleğe yönlendirir', () => {
    expect(get('/', 'navigate')).toBe('shell');
    expect(get('/?screen=matches', 'navigate')).toBe('shell');
    expect(get('/assets/index-abc123.js')).toBe('asset');
  });

  it('yalnızca canlı program ve kaynak durumunu çevrimdışı için saklar', () => {
    expect(get('/api/live')).toBe('data');
    expect(get('/api/source-status')).toBe('data');
  });

  it('onay, AI, bildirim, indirme ve diğer tüm API uçlarını asla önbelleğe almaz', () => {
    for (const path of ['/api/askf-review', '/api/ai-assist', '/api/notifications', '/api/askf-download', '/api/cron-askf', '/api/push-subscribe']) {
      expect(get(path)).toBe('network-only');
    }
  });

  it('oyuncu verisi, oyuncu fotoğrafı ve hava uçlarını (alt yol/sorgu dahil) asla önbelleğe almaz', () => {
    for (const path of ['/api/players', '/api/players?id=abc', '/api/player-photo?id=abc-123', '/api/weather?at=2026-11-20T12:00:00']) {
      expect(get(path.split('?')[0])).toBe('network-only');
    }
    expect(get('/api/player-photo/extra')).toBe('network-only');
  });

  it('POST ve başka kaynaklı istekleri önbelleğe almaz', () => {
    expect(policy(new URL('https://v4.example.com/api/live'), { method: 'POST' })).toBe('network-only');
    expect(policy(new URL('https://baska.example.com/assets/x.js'), { method: 'GET' })).toBe('network-only');
  });
});

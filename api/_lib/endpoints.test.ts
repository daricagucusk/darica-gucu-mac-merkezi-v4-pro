import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeReq, fakeRes, memoryBlob, SAME_ORIGIN } from './test-utils';

const mem = memoryBlob();
vi.mock('@vercel/blob', () => ({
  get: (p: string) => mem.get(p),
  put: (p: string, b: string | Uint8Array, o: { contentType: string }) => mem.put(p, b, o),
  del: (p: string | string[]) => mem.del(p),
}));

const { default: players } = await import('../players');
const { default: photo } = await import('../player-photo');
const { default: weather } = await import('../weather');
const { clearWeatherCache } = await import('./weather');

const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 2, 3]);
const OTHER = { origin: 'https://evil.example.net' };

type Handler = (req: never, res: never) => Promise<void>;

async function call(handler: unknown, opts: Parameters<typeof fakeReq>[0]) {
  const r = fakeRes();
  await (handler as Handler)(fakeReq(opts) as never, r.res as never);
  await Promise.race([r.done, new Promise((x) => setTimeout(x, 100))]);
  return r;
}
const post = (body: unknown, headers: Record<string, string> = SAME_ORIGIN) =>
  call(players, { method: 'POST', url: '/api/players', headers, json: body });
const sample = { name: 'Test Oyuncu', number: 9, position: 'Forvet', team: 'U-15' };
const noStore = (r: { headers: Record<string, string> }) => expect(r.headers['cache-control']).toMatch(/no-store/);

beforeEach(() => {
  mem.store.clear();
  clearWeatherCache();
  vi.unstubAllGlobals();
  vi.spyOn(console, 'info').mockImplementation(() => undefined);
});

describe('/api/players', () => {
  it('ekler, listeler; yanıtta photoKey/Blob yolu sızmaz; no-store', async () => {
    const added = await post(sample);
    expect(added.code()).toBe(200);
    noStore(added);
    const id = (added.json() as { player: { id: string } }).player.id;
    await call(photo, { method: 'POST', url: `/api/player-photo?id=${id}`, headers: { ...SAME_ORIGIN, 'content-type': 'image/jpeg' }, raw: JPEG });
    const list = await call(players, { method: 'GET', url: '/api/players' });
    noStore(list);
    expect(list.text()).not.toMatch(/photoKey|players\/photos|blob\.vercel/);
    expect((list.json() as { players: { hasPhoto: boolean }[] }).players[0].hasPhoto).toBe(true);
  });
  it('farklı origin veya origin yok: POST/DELETE 403', async () => {
    expect((await post(sample, OTHER)).code()).toBe(403);
    expect((await post(sample, {})).code()).toBe(403);
    const del = await call(players, { method: 'DELETE', url: '/api/players?id=abcdef-1', headers: OTHER });
    expect(del.code()).toBe(403);
    noStore(del);
    expect(mem.store.size).toBe(0);
  });
  it('TC/IBAN içeren ad ve aynı takım+numara: 400', async () => {
    expect((await post({ ...sample, name: 'Ali 12345678901' })).code()).toBe(400);
    expect((await post({ ...sample, name: 'Ali TR330006100519786457841326' })).code()).toBe(400);
    expect((await post(sample)).code()).toBe(200);
    const dup = await post({ ...sample, name: 'Başka' });
    expect(dup.code()).toBe(400);
    noStore(dup);
    expect((await post({ ...sample, name: 'Başka', team: 'U-17' })).code()).toBe(200);
  });
  it('siler; olmayan 404; geçersiz id 400; yanlış yöntem 405', async () => {
    const id = ((await post(sample)).json() as { player: { id: string } }).player.id;
    expect((await call(players, { method: 'DELETE', url: `/api/players?id=${id}`, headers: SAME_ORIGIN })).code()).toBe(200);
    expect((await call(players, { method: 'DELETE', url: `/api/players?id=${id}`, headers: SAME_ORIGIN })).code()).toBe(404);
    expect((await call(players, { method: 'DELETE', url: '/api/players?id=../x', headers: SAME_ORIGIN })).code()).toBe(400);
    const put = await call(players, { method: 'PUT', url: '/api/players', headers: SAME_ORIGIN });
    expect(put.code()).toBe(405);
    noStore(put);
  });
});

describe('/api/player-photo', () => {
  async function newId() { return ((await post(sample)).json() as { player: { id: string } }).player.id; }
  const up = (id: string, type: string, raw: Uint8Array, headers: Record<string, string> = SAME_ORIGIN) =>
    call(photo, { method: 'POST', url: `/api/player-photo?id=${id}`, headers: { ...headers, 'content-type': type }, raw });
  const photoKeys = () => [...mem.store.keys()].filter((k) => k.startsWith('players/photos/'));

  it('yükler, sunucudan akıtır (private, no-store), siler', async () => {
    const id = await newId();
    const ok = await up(id, 'image/jpeg', JPEG);
    expect(ok.code()).toBe(200);
    noStore(ok);
    expect(photoKeys().some((k) => k.startsWith(`players/photos/${id}-`))).toBe(true);
    const got = await call(photo, { method: 'GET', url: `/api/player-photo?id=${id}` });
    expect(got.code()).toBe(200);
    expect(got.headers['cache-control']).toMatch(/private, no-store/);
    expect(got.headers['content-type']).toBe('image/jpeg');
    const removed = await call(photo, { method: 'DELETE', url: `/api/player-photo?id=${id}`, headers: SAME_ORIGIN });
    expect(removed.code()).toBe(200);
    expect(photoKeys()).toHaveLength(0);
    expect((await call(photo, { method: 'GET', url: `/api/player-photo?id=${id}` })).code()).toBe(404);
  });
  it('yanlış Content-Type 400; 1,5 MB üstü 413; imza uyuşmazlığı 400; oyuncu yok 404', async () => {
    const id = await newId();
    const gif = await up(id, 'image/gif', JPEG);
    expect(gif.code()).toBe(400);
    noStore(gif);
    const big = new Uint8Array(1.5 * 1024 * 1024 + 1);
    big.set(JPEG);
    const tooBig = await up(id, 'image/jpeg', big);
    expect(tooBig.code()).toBe(413);
    noStore(tooBig);
    expect((await up(id, 'image/png', JPEG)).code()).toBe(400);
    const none = await up('yok-yok-yok', 'image/jpeg', JPEG);
    expect(none.code()).toBe(404);
    noStore(none);
    expect(photoKeys()).toHaveLength(0);
  });
  it('farklı origin 403, geçersiz id 400', async () => {
    const id = await newId();
    expect((await up(id, 'image/jpeg', JPEG, OTHER)).code()).toBe(403);
    expect((await call(photo, { method: 'DELETE', url: `/api/player-photo?id=${id}`, headers: OTHER })).code()).toBe(403);
    expect((await call(photo, { method: 'GET', url: '/api/player-photo?id=../x' })).code()).toBe(400);
  });
});

describe('/api/weather', () => {
  it('ağ hatasında available:false, sıcaklık/etiket alanı yok', async () => {
    vi.stubGlobal('fetch', async () => { throw new Error('ağ'); });
    const at = new Date(Date.now() + 2 * 86400000).toISOString();
    const r = await call(weather, { method: 'GET', url: `/api/weather?at=${at}` });
    expect(r.code()).toBe(200);
    expect(r.json()).toEqual({ available: false, source: 'Open-Meteo (CC BY 4.0)' });
    expect(r.headers['cache-control']).not.toMatch(/1800/);
  });
  it('at yoksa ağa çıkmaz; 16 günden uzak available:false', async () => {
    const f = vi.fn();
    vi.stubGlobal('fetch', f);
    expect((await call(weather, { method: 'GET', url: '/api/weather' })).json()).toMatchObject({ available: false });
    const far = new Date(Date.now() + 30 * 86400000).toISOString();
    expect((await call(weather, { method: 'GET', url: `/api/weather?at=${far}` })).json()).toMatchObject({ available: false });
    expect(f).not.toHaveBeenCalled();
  });
  it('başarıda CDN başlığı ve gerçek veri; POST 405 no-store', async () => {
    const t = new Date(Date.now() + 2 * 86400000);
    t.setUTCMinutes(0, 0, 0);
    const local = new Date(t.getTime() + 3 * 3600000).toISOString().slice(0, 16); // İstanbul UTC+3
    vi.stubGlobal('fetch', async () => ({ ok: true, json: async () => ({ hourly: { time: [local], temperature_2m: [14.4], weathercode: [0] } }) }));
    const r = await call(weather, { method: 'GET', url: `/api/weather?at=${t.toISOString()}` });
    expect(r.json()).toMatchObject({ available: true, temperatureC: 14, label: 'Açık' });
    expect(r.headers['cache-control']).toBe('public, s-maxage=1800, stale-while-revalidate=600');
    const p = await call(weather, { method: 'POST', url: '/api/weather' });
    expect(p.code()).toBe(405);
    noStore(p);
  });
});

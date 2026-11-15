// Afiş şablonlarının gerçek tuval çıktısı: arayüzü sürer (sekme, şablon, skor, MVP, tema), tuvali PNG olarak kaydeder.
// Kullanım: npx vite build && node scripts/poster-shots.mjs
// Çıktı: artifacts/posters/<id>.png ve taşma özeti (360/390/768/1440). stitch-shots.mjs içe aktarılmaz (üst düzey main() çağırır).
import { createServer } from 'node:http';
import { existsSync, readdirSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DIST = join(ROOT, 'dist');
const OUT = join(ROOT, 'artifacts', 'posters');
const MOCK_FILE = join(ROOT, 'scripts', 'fixtures', 'api-mock.json');

function findChromium() {
  if (process.env.PW_CHROMIUM) return process.env.PW_CHROMIUM;
  const bases = [
    process.env.PLAYWRIGHT_BROWSERS_PATH,
    process.env.LOCALAPPDATA && join(process.env.LOCALAPPDATA, 'ms-playwright'),
    process.env.HOME && join(process.env.HOME, '.cache', 'ms-playwright'),
    process.env.HOME && join(process.env.HOME, 'Library', 'Caches', 'ms-playwright'),
  ].filter((b) => b && existsSync(b));
  const rels = [
    ['chrome-win64', 'chrome.exe'], ['chrome-win', 'chrome.exe'],
    ['chrome-linux64', 'chrome'], ['chrome-linux', 'chrome'],
    ['chrome-mac', 'Chromium.app', 'Contents', 'MacOS', 'Chromium'],
  ];
  for (const base of bases) {
    const dirs = readdirSync(base).filter((d) => /^chromium-\d+$/.test(d))
      .sort((a, b) => Number(b.split('-')[1]) - Number(a.split('-')[1]));
    for (const d of dirs) for (const rel of rels) {
      const p = join(base, d, ...rel);
      if (existsSync(p)) return p;
    }
  }
  throw new Error('Chromium bulunamadı. PW_CHROMIUM ortam değişkeniyle chrome.exe yolunu ver.');
}

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.woff': 'font/woff',
  '.txt': 'text/plain',
};
function startServer() {
  const server = createServer(async (req, res) => {
    try {
      const pathname = decodeURIComponent(new URL(req.url, 'http://x').pathname);
      let file = normalize(join(DIST, pathname));
      if (file !== DIST && !file.startsWith(DIST + sep)) { res.writeHead(403).end(); return; }
      if (!existsSync(file) || extname(file) === '') file = join(DIST, 'index.html'); // SPA geri dönüşü
      const body = await readFile(file);
      res.writeHead(200, { 'Content-Type': MIME[extname(file)] ?? 'application/octet-stream' }).end(body);
    } catch (e) { console.error("SRV", e.message); res.writeHead(500).end(); }
  });
  return new Promise((ok) => server.listen(0, '127.0.0.1', () => ok({ server, port: server.address().port })));
}


async function newPage(browser, base, mock, width, height) {
  const context = await browser.newContext({
    viewport: { width, height }, deviceScaleFactor: 1, locale: 'tr-TR', timezoneId: 'Europe/Istanbul', serviceWorkers: 'block',
    isMobile: width < 700, hasTouch: width < 700,
  });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.route('**/api/**', (route) => {
    const req = route.request();
    const { pathname } = new URL(req.url());
    const hit = mock.routes[`${req.method()} ${pathname}`] ?? mock.routes[pathname] ?? null;
    if (!hit) return route.fulfill({ status: 404, contentType: 'application/json', body: '{"error":"mock yok"}' });
    return route.fulfill({ status: hit.status ?? 200, contentType: 'application/json', body: JSON.stringify(hit.body ?? null) });
  });
  if (mock.clock) await page.clock.setFixedTime(new Date(mock.clock));
  await page.goto(`${base}/?screen=posters`, { waitUntil: 'networkidle' });
  await page.waitForSelector('.pss-stage');
  return { context, page, errors };
}

async function settle(page) {
  await page.waitForFunction(() => document.querySelector('.pss-stage')?.getAttribute('data-render-state') !== 'rendering', null, { timeout: 15000 });
  await page.waitForTimeout(400);
  await page.waitForFunction(() => document.querySelector('.pss-stage')?.getAttribute('data-render-state') !== 'rendering', null, { timeout: 15000 });
}

async function saveCanvas(page, id) {
  await settle(page);
  const state = await page.getAttribute('.pss-stage', 'data-render-state');
  const url = await page.evaluate(() => document.querySelector('.pss-canvas').toDataURL('image/png'));
  const size = await page.evaluate(() => [document.querySelector('.pss-canvas').width, document.querySelector('.pss-canvas').height]);
  await writeFile(join(OUT, `${id}.png`), Buffer.from(url.split(',')[1], 'base64'));
  return { id, state, size: size.join('x') };
}

const click = (page, name, exact = true) => page.getByRole('button', { name, exact }).first().click();

async function main() {
  if (!existsSync(join(DIST, 'index.html'))) throw new Error('dist/ yok. Önce: npx vite build');
  const mock = JSON.parse(await readFile(MOCK_FILE, 'utf8'));
  await mkdir(OUT, { recursive: true });
  const { server, port } = await startServer();
  const base = `http://127.0.0.1:${port}`;
  const browser = await chromium.launch({ executablePath: findChromium(), headless: true });
  const results = [];
  const overflow = [];
  try {
    const { context, page, errors } = await newPage(browser, base, mock, 1440, 900);
    // Instagram 4:5 şablonlar
    await click(page, /^Instagram/, false);
    results.push(await saveCanvas(page, 'matchday-45'));
    await click(page, 'Haftalık program');
    results.push(await saveCanvas(page, 'weekly-program-45'));
    await click(page, 'Maç sonucu');
    await page.getByLabel(/ skoru$/).nth(0).fill('2');
    await page.getByLabel(/ skoru$/).nth(1).fill('1');
    results.push(await saveCanvas(page, 'result-45'));
    await click(page, 'Kulüp duyurusu');
    await page.getByLabel('Ana başlık').fill('Yeni sezon kayıtları: Ğüşiöç İI');
    results.push(await saveCanvas(page, 'announcement-45'));
    await click(page, 'Kare 1:1');
    await click(page, 'Maç günü');
    results.push(await saveCanvas(page, 'matchday-square'));
    // Hikaye
    await click(page, 'Hikaye (9:16)');
    await click(page, 'Klasik');
    results.push(await saveCanvas(page, 'matchday-story-classic'));
    await click(page, /^A ·/, false);
    results.push(await saveCanvas(page, 'story-a'));
    await page.getByLabel('Sponsor bandı').check();
    results.push(await saveCanvas(page, 'story-a-sponsors'));
    await page.getByLabel('Sponsor bandı').uncheck();
    await click(page, /^C ·/, false);
    results.push(await saveCanvas(page, 'story-c-no-score-no-mvp'));
    await page.getByLabel(/ skoru$/).nth(0).fill('3');
    await page.getByLabel(/ skoru$/).nth(1).fill('1');
    await click(page, 'MVP seç');
    results.push(await saveCanvas(page, 'story-c'));
    // Shorts
    await click(page, /^Shorts/, false);
    await page.getByLabel('Kapak başlığı').fill('Şampiyonluk Yolunda: Ğ Ü Ş İ Ö Ç');
    for (const [name, id] of [['Darıca Zümrüt', 'shorts-club-emerald'], ['YouTube Kırmızı', 'shorts-youtube-red'], ['TikTok Mor', 'shorts-tiktok-purple']]) {
      await click(page, name, false);
      results.push(await saveCanvas(page, id));
    }
    await page.getByLabel('Sponsor bandı').check();
    results.push(await saveCanvas(page, 'shorts-sponsors'));
    await context.close();
    for (const e of errors) console.log('konsol hatası:', e);

    // Yatay taşma: Fold kapak (360), 390, Fold açık/tablet (768), masaüstü
    for (const [w, h] of [[360, 780], [390, 844], [768, 1000], [1440, 900]]) {
      for (const tabName of [/^Instagram/, /^Hikaye/, /^Shorts/]) {
        const ctx = await newPage(browser, base, mock, w, h);
        await click(ctx.page, tabName, false);
        await settle(ctx.page);
        const r = await ctx.page.evaluate(() => {
          const de = document.documentElement;
          const stage = document.querySelector('.pss').getBoundingClientRect();
          const bad = [];
          for (const el of document.querySelectorAll('.pss *')) {
            const b = el.getBoundingClientRect();
            if (b.width > 0 && b.right > de.clientWidth + 1 && !el.closest('.pss-tabs-scroll')) bad.push(el.tagName.toLowerCase() + '.' + String(el.className).split(' ')[0]);
          }
          return { scrollWidth: de.scrollWidth, clientWidth: de.clientWidth, studioRight: Math.round(stage.right), bad: bad.slice(0, 5) };
        });
        overflow.push({ viewport: `${w}`, tab: String(tabName), ...r });
        await ctx.page.screenshot({ path: join(OUT, `studio-${w}-${String(tabName).replace(/[^a-zA-Z]/g, '')}.png`), fullPage: true });
        await ctx.context.close();
      }
    }
  } finally {
    await browser.close();
    server.close();
  }
  for (const r of results) console.log(`${r.state === 'done' ? 'ok   ' : 'HATA '} ${r.id} ${r.size}`);
  for (const o of overflow) console.log(`${o.scrollWidth > o.clientWidth ? 'TAŞMA' : 'ok   '} ${o.viewport} ${o.tab} sw=${o.scrollWidth}/cw=${o.clientWidth} dışarıda=${o.bad.join(',') || '-'}`);
  await writeFile(join(OUT, 'report.json'), JSON.stringify({ generatedAt: new Date().toISOString(), results, overflow }, null, 2));
}

main().catch((e) => { console.error(e); process.exit(1); });

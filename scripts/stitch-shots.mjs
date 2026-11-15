// Stitch karşılaştırma ekran görüntüsü düzeneği.
// Kullanım: npx vite build && npm run shots [-- --compare] [-- --only=dashboard,source]
// dist/ klasörünü yerel statik sunucuyla açar, /api/* yanıtlarını scripts/fixtures/api-mock.json'dan verir.
import { createServer } from 'node:http';
import { existsSync, readdirSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DIST = join(ROOT, 'dist');
const OUT = join(ROOT, 'artifacts', 'stitch');
const REF_DIR = join(ROOT, 'docs', 'referans', 'stitch');
const MOCK_FILE = join(ROOT, 'scripts', 'fixtures', 'api-mock.json');

// ---------------------------------------------------------------------------
// Ekran tablosu. Yeni ekran eklemek için bir satır ekle.
//   id        : dosya adı öneki
//   screen    : uygulamadaki ?screen= değeri (App.tsx navigation id)
//   action    : (opsiyonel) sayfa açıldıktan sonra tıklanacak seçici
//   waitFor   : (opsiyonel) action sonrası beklenecek seçici
// Eşleme tablosu (karşılaştırma): ekran + görünüm (390 | desktop) -> docs/referans/stitch/<klasör>/screen.png
// ---------------------------------------------------------------------------
const SCREENS = [
  { id: 'dashboard', screen: 'dashboard' },
  { id: 'matches', screen: 'matches' },
  { id: 'clubs', screen: 'clubs' },
  { id: 'venues', screen: 'venues' },
  { id: 'changes', screen: 'changes' },
  { id: 'posters', screen: 'posters' },
  { id: 'source', screen: 'source' },
  { id: 'notifications', screen: 'dashboard', action: '.notification-trigger', waitFor: '.notification-drawer' },
];
const COMPARE_MAP = [
  { id: 'dashboard', vp: '390', folder: 'mobil_mac_ajandasi' },
  { id: 'matches', vp: '390', folder: 'mobil_mac_ajandasi' },
  { id: 'posters', vp: '390', folder: 'mobil_paylasim_studyosu' },
  { id: 'source', vp: '390', folder: 'mobil_askf_veri_merkezi' },
  { id: 'changes', vp: '390', folder: 'degisiklik_dedektoru_1' },
  { id: 'dashboard', vp: 'desktop', folder: 'degisiklik_dedektoru_1', suffix: 'ref1' },
  { id: 'dashboard', vp: 'desktop', folder: 'degisiklik_dedektoru_2', suffix: 'ref2' },
];
const VIEWPORTS = {
  '390': { width: 390, height: 844, deviceScaleFactor: 2 },
  desktop: { width: 1440, height: 900, deviceScaleFactor: 1 },
};

const args = process.argv.slice(2);
const COMPARE = args.includes('--compare');
const onlyArg = args.find((a) => a.startsWith('--only='));
const ONLY = onlyArg ? onlyArg.slice(7).split(',') : null;

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
    } catch { res.writeHead(500).end(); }
  });
  return new Promise((ok) => server.listen(0, '127.0.0.1', () => ok({ server, port: server.address().port })));
}

function mockLookup(routes, method, pathname) {
  return routes[`${method} ${pathname}`] ?? routes[pathname] ?? null;
}

async function shoot(context, base, mock, entry, vpName) {
  const page = await context.newPage();
  const consoleErrors = [];
  const unmocked = [];
  page.on('pageerror', (e) => consoleErrors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });
  await page.route('**/api/**', (route) => {
    const req = route.request();
    const { pathname } = new URL(req.url());
    const hit = mockLookup(mock.routes, req.method(), pathname);
    if (!hit) { unmocked.push(`${req.method()} ${pathname}`); return route.fulfill({ status: 404, contentType: 'application/json', body: '{"error":"mock yok"}' }); }
    return route.fulfill({ status: hit.status ?? 200, contentType: 'application/json', body: JSON.stringify(hit.body ?? null) });
  });
  if (mock.clock) await page.clock.setFixedTime(new Date(mock.clock));
  await page.goto(`${base}/?screen=${entry.screen}`, { waitUntil: 'networkidle' });
  await page.waitForSelector('.app-shell');
  await page.waitForFunction(() => !document.body.innerText.includes('yükleniyor'), null, { timeout: 5000 }).catch(() => {});
  if (entry.action) {
    await page.click(entry.action);
    if (entry.waitFor) await page.waitForSelector(entry.waitFor);
    await page.waitForLoadState('networkidle');
  }
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(500);
  const overflow = await page.evaluate(() => {
    const de = document.documentElement;
    const offenders = [];
    for (const el of document.body.querySelectorAll('*')) {
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.right > de.clientWidth + 1 && getComputedStyle(el).position !== 'fixed') {
        offenders.push(`${el.tagName.toLowerCase()}${el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\s+/).join('.') : ''}`);
        if (offenders.length >= 5) break;
      }
    }
    return { overflow: de.scrollWidth > de.clientWidth, scrollWidth: de.scrollWidth, clientWidth: de.clientWidth, offenders };
  });
  const bodyText = (await page.evaluate(() => document.body.innerText)).length;
  const file = `${entry.id}-${vpName}.png`;
  await page.screenshot({ path: join(OUT, file), fullPage: true });
  await page.close();
  return { screen: entry.id, viewport: vpName, file: `artifacts/stitch/${file}`, ...overflow, textLength: bodyText, consoleErrors, unmockedApi: [...new Set(unmocked)] };
}

async function compareImages(browser, pair) {
  const colW = pair.vp === '390' ? 390 : 720;
  const [ours, ref] = await Promise.all([
    readFile(join(OUT, `${pair.id}-${pair.vp}.png`)),
    readFile(join(REF_DIR, pair.folder, 'screen.png')),
  ]);
  const img = (b) => `data:image/png;base64,${b.toString('base64')}`;
  const html = `<!doctype html><meta charset="utf-8"><style>
    body{margin:0;background:#222;color:#fff;font:12px/1.4 monospace}
    .row{display:flex;gap:12px;align-items:flex-start;padding:12px}
    .col{width:${colW}px;flex:none}.col img{width:${colW}px;display:block}
    h4{margin:0 0 6px}</style>
    <div class="row"><div class="col"><h4>UYGULAMA · ${pair.id} · ${pair.vp}</h4><img src="${img(ours)}"></div>
    <div class="col"><h4>STITCH · ${pair.folder}</h4><img src="${img(ref)}"></div></div>`;
  const page = await browser.newPage({ viewport: { width: colW * 2 + 36, height: 800 } });
  await page.setContent(html, { waitUntil: 'load' });
  await page.waitForFunction(() => [...document.images].every((i) => i.complete));
  const name = `compare-${pair.id}-${pair.vp}${pair.suffix ? '-' + pair.suffix : ''}.png`;
  await page.screenshot({ path: join(OUT, name), fullPage: true });
  await page.close();
  return `artifacts/stitch/${name}`;
}

async function main() {
  if (!existsSync(join(DIST, 'index.html'))) throw new Error('dist/ yok. Önce: npx vite build');
  const mock = JSON.parse(await readFile(MOCK_FILE, 'utf8'));
  await mkdir(OUT, { recursive: true });
  const { server, port } = await startServer();
  const base = `http://127.0.0.1:${port}`;
  const exe = findChromium();
  console.log(`Chromium: ${exe}\nSunucu: ${base}`);
  const browser = await chromium.launch({ executablePath: exe, headless: true });
  const results = [];
  const compares = [];
  try {
    for (const vpName of Object.keys(VIEWPORTS)) {
      const context = await browser.newContext({
        viewport: { width: VIEWPORTS[vpName].width, height: VIEWPORTS[vpName].height },
        deviceScaleFactor: VIEWPORTS[vpName].deviceScaleFactor,
        locale: 'tr-TR', timezoneId: 'Europe/Istanbul', serviceWorkers: 'block',
        isMobile: vpName === '390', hasTouch: vpName === '390',
      });
      for (const entry of SCREENS) {
        if (ONLY && !ONLY.includes(entry.id)) continue;
        const r = await shoot(context, base, mock, entry, vpName);
        results.push(r);
        console.log(`${r.overflow ? 'TAŞMA' : 'ok   '} ${r.screen}-${vpName} (${r.scrollWidth}/${r.clientWidth}) metin=${r.textLength}${r.unmockedApi.length ? ' mocksuz=' + r.unmockedApi.join(',') : ''}`);
      }
      await context.close();
    }
    if (COMPARE) {
      for (const pair of COMPARE_MAP) {
        if (ONLY && !ONLY.includes(pair.id)) continue;
        if (!existsSync(join(REF_DIR, pair.folder, 'screen.png'))) { console.log(`atlandı (referans yok): ${pair.folder}`); continue; }
        if (!results.some((r) => r.screen === pair.id && r.viewport === pair.vp)) continue;
        compares.push(await compareImages(browser, pair));
      }
    }
  } finally {
    await browser.close();
    server.close();
  }
  await writeFile(join(OUT, 'report.json'), JSON.stringify({ generatedAt: new Date().toISOString(), results, compares }, null, 2));
  const overflowing = results.filter((r) => r.overflow);
  console.log(`\n${results.length} görüntü, ${compares.length} karşılaştırma, ${overflowing.length} yatay taşma. Rapor: artifacts/stitch/report.json`);
}

main().catch((e) => { console.error(e); process.exit(1); });

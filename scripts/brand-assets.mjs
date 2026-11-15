// Marka varlıkları üretici: resmi arma (beyaz zeminden şeffaf), PWA ikonları, favicon, sponsor logoları.
// Kullanım: node scripts/brand-assets.mjs
// Yeni bağımlılık yok: playwright-core + yerel chromium, işlem tuvalde (canvas) yapılır.
// Kaynak klasörü `sponsorlar/` git'e girmez (.gitignore); çıktılar (public/brand, public/sponsors, ikonlar) repoda kalır.
// Önizleme (koyu yeşil / macenta zemin, kenar büyütmesi): artifacts/brand-preview/ (git dışı).
import { existsSync, readdirSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(ROOT, 'sponsorlar');
const PUB = join(ROOT, 'public');
const PREVIEW = join(ROOT, 'artifacts', 'brand-preview');

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

const dataUrl = async (file, mime) => `data:${mime};base64,${(await readFile(file)).toString('base64')}`;
const out = (rel, dataURL) => writeFile(join(PUB, rel), Buffer.from(dataURL.split(',')[1], 'base64'));

/** Tarayıcı içinde çalışan işlemler (tek sayfa, tek evaluate). */
function inPage(input) {
  const { crestSrc, sponsors } = input;
  const load = (src) => new Promise((ok, fail) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => fail(new Error('görsel okunamadı')); i.src = src; });
  const mk = (w, h) => { const c = document.createElement('canvas'); c.width = Math.round(w); c.height = Math.round(h); return c; };
  const ctxOf = (c) => { const x = c.getContext('2d', { willReadFrequently: true }); x.imageSmoothingEnabled = true; x.imageSmoothingQuality = 'high'; return x; };
  const fromImage = (img) => { const c = mk(img.naturalWidth, img.naturalHeight); ctxOf(c).drawImage(img, 0, 0); return c; };

  /** Kenarlardan flood-fill: yalnız dış kenara bağlı "beyaz" alan şeffaflaşır (iç beyaz/gümüş korunur). */
  function cutBackground(canvas) {
    const w = canvas.width; const h = canvas.height;
    const ctx = ctxOf(canvas);
    const img = ctx.getImageData(0, 0, w, h); const d = img.data;
    // Zemin rengi: dört köşenin ortalaması (yapay zekâ görselleri tam 255 olmayabilir).
    const corners = [[0, 0], [w - 1, 0], [0, h - 1], [w - 1, h - 1]].map(([x, y]) => (y * w + x) * 4);
    const hasAlpha = corners.some((i) => d[i + 3] < 250);
    if (hasAlpha) return { canvas, removed: 0, note: 'zaten şeffaf' };
    const isBg = (i) => {
      const r = d[i]; const g = d[i + 1]; const b = d[i + 2];
      return Math.min(r, g, b) >= 232 && Math.max(r, g, b) - Math.min(r, g, b) <= 14;
    };
    const bg = new Uint8Array(w * h);
    const stack = [];
    const push = (x, y) => { const p = y * w + x; if (!bg[p] && isBg(p * 4)) { bg[p] = 1; stack.push(p); } };
    for (let x = 0; x < w; x++) { push(x, 0); push(x, h - 1); }
    for (let y = 0; y < h; y++) { push(0, y); push(w - 1, y); }
    while (stack.length) {
      const p = stack.pop(); const x = p % w; const y = (p - x) / w;
      if (x > 0) push(x - 1, y); if (x < w - 1) push(x + 1, y);
      if (y > 0) push(x, y - 1); if (y < h - 1) push(x, y + 1);
    }
    let removed = 0;
    for (let p = 0; p < w * h; p++) if (bg[p]) { d[p * 4 + 3] = 0; removed++; }
    // Kenar bandı (zemine 2 px yakın): beyaz karışımını çıkar, alfa yumuşat (beyaz hale olmasın).
    const R = 2;
    const edge = (p) => {
      const x = p % w; const y = (p - x) / w;
      for (let dy = -R; dy <= R; dy++) for (let dx = -R; dx <= R; dx++) {
        const nx = x + dx; const ny = y + dy;
        if (nx >= 0 && ny >= 0 && nx < w && ny < h && bg[ny * w + nx]) return true;
      }
      return false;
    };
    for (let p = 0; p < w * h; p++) {
      if (bg[p] || !edge(p)) continue;
      const i = p * 4;
      const m = Math.min(d[i], d[i + 1], d[i + 2]);
      if (m <= 130) continue; // koyu dış çizgi: dokunma
      const a = Math.max(0.15, Math.min(1, (255 - m) / 125));
      for (let k = 0; k < 3; k++) d[i + k] = Math.max(0, Math.min(255, Math.round((d[i + k] - (1 - a) * 255) / a)));
      d[i + 3] = Math.round(255 * a);
    }
    ctx.putImageData(img, 0, 0);
    return { canvas, removed: removed / (w * h), note: 'flood-fill' };
  }

  function trim(canvas, pad = 0) {
    const w = canvas.width; const h = canvas.height;
    const d = ctxOf(canvas).getImageData(0, 0, w, h).data;
    let x0 = w; let y0 = h; let x1 = -1; let y1 = -1;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (d[(y * w + x) * 4 + 3] > 8) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    const bw = x1 - x0 + 1; const bh = y1 - y0 + 1;
    const out = mk(bw + pad * 2, bh + pad * 2);
    ctxOf(out).drawImage(canvas, x0, y0, bw, bh, pad, pad, bw, bh);
    return out;
  }

  function squarePad(canvas, margin = 0.02) {
    const s = Math.round(Math.max(canvas.width, canvas.height) * (1 + margin * 2));
    const out = mk(s, s);
    ctxOf(out).drawImage(canvas, Math.round((s - canvas.width) / 2), Math.round((s - canvas.height) / 2));
    return out;
  }

  /** Yarıya bölerek küçültme: tek adımda büyük oran küçültmenin tırtıklarını önler. */
  function resize(canvas, w, h) {
    let cur = canvas;
    while (cur.width / 2 >= w && cur.height / 2 >= h) {
      const n = mk(cur.width / 2, cur.height / 2); ctxOf(n).drawImage(cur, 0, 0, n.width, n.height); cur = n;
    }
    const n = mk(w, h); ctxOf(n).drawImage(cur, 0, 0, w, h); return n;
  }

  function fitInto(size, canvas, ratio, bgFill) {
    const out = mk(size, size); const c = ctxOf(out);
    if (bgFill) bgFill(c, size);
    const k = Math.min(size * ratio / canvas.width, size * ratio / canvas.height);
    const dw = canvas.width * k; const dh = canvas.height * k;
    // Küçük boyutlarda yüksek kaliteli indirgeme için önce ara canvas.
    const small = resize(canvas, Math.max(1, Math.round(dw)), Math.max(1, Math.round(dh)));
    c.drawImage(small, (size - small.width) / 2, (size - small.height) / 2);
    return out;
  }

  const darkGreen = (c, s) => {
    const g = c.createRadialGradient(s / 2, s * 0.3, s * 0.05, s / 2, s / 2, s * 0.8);
    g.addColorStop(0, '#1a4b33'); g.addColorStop(0.55, '#0d251a'); g.addColorStop(1, '#050d09');
    c.fillStyle = g; c.fillRect(0, 0, s, s);
  };

  return (async () => {
    const result = { files: {}, log: [], previews: {} };
    // ---- Arma ----
    const crestImg = await load(crestSrc);
    const cut = cutBackground(fromImage(crestImg));
    result.log.push(`arma: ${crestImg.naturalWidth}px, zemin ${cut.note}, şeffaflaşan alan %${(cut.removed * 100).toFixed(1)}`);
    const crest = squarePad(trim(cut.canvas), 0.015);
    const png = (c) => c.toDataURL('image/png');
    result.files['brand/darica-gucu-arma-1024.png'] = png(resize(crest, 1024, 1024));
    result.files['brand/darica-gucu-arma.png'] = png(resize(crest, 512, 512));
    // İkonlar
    result.files['icon-512.png'] = png(fitInto(512, crest, 0.9, null));
    result.files['icon-192.png'] = png(fitInto(192, crest, 0.9, null));
    const maskable = fitInto(512, crest, 0.56, darkGreen); // güvenli daire (çap %80) içinde
    result.files['icon-maskable-512.png'] = png(maskable);
    result.files['apple-touch-icon.png'] = png(fitInto(180, crest, 0.78, darkGreen)); // iOS şeffaflığı siyah gösterir
    result.files['favicon-32.png'] = png(fitInto(32, crest, 0.96, null));
    const svgPng = fitInto(192, crest, 0.86, null).toDataURL('image/png');
    result.files['icon.svg'] = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 192 192"><defs><radialGradient id="bg" cx=".5" cy=".3" r=".8"><stop offset="0" stop-color="#1a4b33"/><stop offset=".55" stop-color="#0d251a"/><stop offset="1" stop-color="#050d09"/></radialGradient></defs><rect width="192" height="192" rx="40" fill="url(#bg)"/><image href="${svgPng}" xlink:href="${svgPng}" x="12" y="12" width="168" height="168"/></svg>\n`;
    // Önizlemeler
    const comp = (bgColor, scale) => {
      const s = 512; const o = mk(s, s); const c = ctxOf(o); c.fillStyle = bgColor; c.fillRect(0, 0, s, s); c.drawImage(crest, 0, 0, s, s); return o;
    };
    result.previews['crest-on-green.png'] = png(comp('#0d251a', 1));
    result.previews['crest-on-magenta.png'] = png(comp('#ff00ff', 1));
    const edge = mk(512, 512); const ec = ctxOf(edge); ec.imageSmoothingEnabled = false; ec.fillStyle = '#ff00ff'; ec.fillRect(0, 0, 512, 512);
    ec.drawImage(crest, 0, crest.height * 0.82, 160, 160, 0, 0, 512, 512); // sol alt kanat/banner ucu 3,2x
    result.previews['edge-crop-magenta.png'] = png(edge);
    const mk2 = mk(512, 512); const mc = ctxOf(mk2); mc.drawImage(maskable, 0, 0);
    mc.strokeStyle = '#ff00ff'; mc.lineWidth = 3; mc.beginPath(); mc.arc(256, 256, 205, 0, Math.PI * 2); mc.stroke();
    result.previews['maskable-safe-circle.png'] = png(mk2);

    // ---- Sponsor logoları ----
    for (const s of sponsors) {
      const img = await load(s.src);
      const cutS = cutBackground(fromImage(img));
      let c = trim(cutS.canvas, 2);
      // Yükseltme yok: yalnız büyükse küçült (ör. 256 px enine/boyuna).
      const k = Math.min(1, s.max / Math.max(c.width, c.height));
      if (k < 1) c = resize(c, Math.round(c.width * k), Math.round(c.height * k));
      result.files[`sponsors/${s.out}`] = png(c);
      result.log.push(`${s.out}: kaynak ${img.naturalWidth}x${img.naturalHeight}, ${cutS.note}, çıktı ${c.width}x${c.height}`);
      const prev = mk(c.width + 40, c.height + 40); const pc = ctxOf(prev); pc.fillStyle = '#ffffff'; pc.fillRect(0, 0, prev.width, prev.height); pc.drawImage(c, 20, 20);
      result.previews[`sponsor-${s.out}`] = png(prev);
    }
    return result;
  })();
}

async function main() {
  const files = {
    crest: join(SRC, 'beyaz_cercevesiz_logo.png'),
    arap: join(SRC, 'arapcesme-dark-logo.png'),
    kanatci: join(SRC, 'kanatçı nizam logo.jpg'),
  };
  for (const f of Object.values(files)) {
    if (!existsSync(f)) {
      console.error(`Kaynak yok: ${f}\n"sponsorlar/" klasörü git'e girmez; kaynak dosyaları yerel kopyadan geri koyun. Çıktılar (public/) zaten repoda.`);
      process.exit(1);
    }
  }
  const input = {
    crestSrc: await dataUrl(files.crest, 'image/png'),
    sponsors: [
      { src: await dataUrl(files.arap, 'image/png'), out: 'arapcesme.png', max: 256 },
      { src: await dataUrl(files.kanatci, 'image/jpeg'), out: 'kanatci-nizam.png', max: 256 },
    ],
  };
  const browser = await chromium.launch({ executablePath: findChromium(), headless: true });
  let result;
  try {
    const page = await browser.newPage();
    await page.setContent('<!doctype html><meta charset="utf-8"><body></body>');
    result = await page.evaluate(inPage, input);
  } finally {
    await browser.close();
  }
  await mkdir(join(PUB, 'brand'), { recursive: true });
  await mkdir(join(PUB, 'sponsors'), { recursive: true });
  await mkdir(PREVIEW, { recursive: true });
  for (const [rel, data] of Object.entries(result.files)) {
    if (rel.endsWith('.svg')) await writeFile(join(PUB, rel), data);
    else await out(rel, data);
    console.log(`yazıldı public/${rel}`);
  }
  for (const [name, data] of Object.entries(result.previews)) await writeFile(join(PREVIEW, name), Buffer.from(data.split(',')[1], 'base64'));
  for (const line of result.log) console.log(line);
  console.log(`Önizleme: ${PREVIEW}`);
}

main().catch((e) => { console.error(e); process.exit(1); });

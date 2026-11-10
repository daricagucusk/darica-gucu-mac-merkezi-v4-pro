import { readFile } from 'node:fs/promises';
import chromium from '@sparticuz/chromium';
import { chromium as playwrightChromium } from 'playwright-core';
import { selectLatestAskfFile } from '../../src/ingestion/source-selection';

const SOURCE_URL = 'https://www.kaskf.org/HaftalikProgram';

function currentSeasonLabel(now = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Europe/Istanbul',
    year: 'numeric',
    month: 'numeric',
  }).formatToParts(now);
  const year = Number(parts.find((part) => part.type === 'year')?.value);
  const month = Number(parts.find((part) => part.type === 'month')?.value);
  return month >= 7 ? `${year}-${year + 1}` : `${year - 1}-${year}`;
}

export interface DownloadedAskfFile {
  fileName: string;
  bytes: Uint8Array;
  sourceUrl: string;
  selectedLabel: string;
}

export async function downloadLatestAskfFile(): Promise<DownloadedAskfFile> {
  const browser = await playwrightChromium.launch({
    args: chromium.args,
    executablePath: await chromium.executablePath(),
    headless: true,
  });

  try {
    const context = await browser.newContext({
      acceptDownloads: true,
      locale: 'tr-TR',
      viewport: { width: 1280, height: 800 },
    });
    const page = await context.newPage();
    await page.goto(SOURCE_URL, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await page.locator('#FileManager1_Splitter_Folders').waitFor({ timeout: 30_000 });
    await page.waitForFunction(
      () => document.querySelectorAll("[id^='FileManager1_Splitter_Items_I']").length > 0 ||
        document.querySelector('#FileManager1_Splitter_Folders_N0_10') !== null,
      undefined,
      { timeout: 30_000 },
    );

    const collectCandidates = async () => {
      const items = page.locator("[id^='FileManager1_Splitter_Items_I']");
      const candidates: Array<{ name: string; label: string; index: number }> = [];
      const count = await items.count();
      for (let index = 0; index < count; index += 1) {
        const label = (await items.nth(index).innerText()).trim();
        candidates.push({ name: label, label, index });
      }
      return { items, candidates };
    };

    let collection = await collectCandidates();
    let selected: ReturnType<typeof selectLatestAskfFile> | null = null;

    try {
      selected = selectLatestAskfFile(collection.candidates);
    } catch {
      const seasonFolder = page.getByText(currentSeasonLabel(), { exact: true }).first();
      if (await seasonFolder.count() === 0) {
        throw new Error('ASKF kök arşivinde güncel sezon klasörü bulunamadı.');
      }
      await seasonFolder.click();
      await page.locator("[id^='FileManager1_Splitter_Items_I']").first().waitFor({ timeout: 30_000 });
      collection = await collectCandidates();
      selected = selectLatestAskfFile(collection.candidates);
    }

    const selectedCandidate = collection.candidates.find((candidate) => candidate.name === selected?.name);
    if (!selectedCandidate) throw new Error('ASKF dosya listesi seçim sırasında değişti.');

    await collection.items.nth(selectedCandidate.index).click();
    const downloadPromise = page.waitForEvent('download', { timeout: 30_000 });
    await page.locator('#FileManager1_Splitter_Toolbar_DXI8_').click();
    const download = await downloadPromise;
    const filePath = await download.path();
    if (!filePath) throw new Error('ASKF indirme dosyası geçici diske yazılamadı.');

    const bytes = await readFile(filePath);
    const fileName = download.suggestedFilename();
    if (bytes.length === 0 || bytes.length > 12 * 1024 * 1024) {
      throw new Error('ASKF dosya boyutu geçersiz veya 12 MB sınırını aşıyor.');
    }

    return {
      fileName,
      bytes,
      sourceUrl: SOURCE_URL,
      selectedLabel: selected.label ?? selected.name,
    };
  } finally {
    await browser.close();
  }
}

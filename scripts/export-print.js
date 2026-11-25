#!/usr/bin/env node
// Exports the print images of the map: for each year and frame, the layered SVG
// (basemap embedded and linked), the two basemap PNGs and a small preview PNG.
// It drives the /print/ page of a running dev server in a headless browser.
// Usage: npm run dev   (in another terminal), then
//        node scripts/export-print.js [--years 1927,1975,2025] [--frames wide,city]
//                                     [--out working/print] [--base http://localhost:4321/io-map/]
// The browser: BROWSER=/path/to/chromium-based-browser (default: Brave on macOS).
import {mkdirSync, writeFileSync} from "node:fs";
import {join} from "node:path";
import {chromium} from "playwright-core";

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : fallback;
};
const years = arg("years", "1927,1975,2025").split(",").map(Number);
const frames = arg("frames", "wide,city").split(",");
const out = arg("out", "working/print");
const base = arg("base", "http://localhost:4321/io-map/");
const executablePath = process.env.BROWSER ?? "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser";

mkdirSync(out, {recursive: true});
const browser = await chromium.launch({executablePath, headless: true});
const context = await browser.newContext({viewport: {width: 1300, height: 1500}, acceptDownloads: true});
const summary = [];

for (const year of years) {
  for (const frame of frames) {
    const page = await context.newPage();
    await page.goto(`${base}print/?year=${year}&frame=${frame}`, {waitUntil: "domcontentloaded"});
    await page.waitForSelector("[data-print-ready]", {timeout: 300000});
    const stats = JSON.parse(await page.locator("#print-stats").getAttribute("data-stats"));
    for (const id of ["download-svg", "download-svg-linked", "download-basemap-dark", "download-basemap-original"]) {
      const [download] = await Promise.all([page.waitForEvent("download"), page.click(`#${id}`)]);
      await download.saveAs(join(out, download.suggestedFilename()));
    }
    // preview: the rendered SVG at 1200 px, for mails and quick review
    await page.locator("#print-preview").evaluate((img) => img.decode());
    await page.setViewportSize({width: 1232, height: 1500});
    await page.locator("#print-preview").screenshot({path: join(out, `geneva-${year}-${frame}-preview.png`)});
    console.log(`${year} ${frame}: ${stats.total} dots ${JSON.stringify(stats.counts)}, ${stats.outside} outside the frame, ${stats.withoutAddress} without address, ${stats.missingTiles} missing tiles, ${stats.basemapLabel} (tile level ${stats.tileZoom})`);
    summary.push(stats);
    await page.close();
  }
}

writeFileSync(join(out, "summary.json"), JSON.stringify(summary, null, 2) + "\n");
await browser.close();
console.log(`export-print: ${summary.length} images in ${out}/`);

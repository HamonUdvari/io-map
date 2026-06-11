#!/usr/bin/env node
// Detects the years in which swisstopo's Zeitreise layer actually changed around Geneva.
// The WMTS accepts every year 1844-2021 as TIME, but map sheets were revised on their own
// cycles, so most years serve an unchanged map. There is no metadata API for this; we hash
// a sample of tiles across all years and record the years where any tile's content changes.
// Output: docs/data/zeitreise-editions.json (ascending list of edition years).
// Usage: node scripts/zeitreise-editions.js  (~900 requests against the tile CDN, a few minutes)
import {writeFileSync} from "node:fs";
import {createHash} from "node:crypto";

const OUT_PATH = "docs/data/zeitreise-editions.json";
const YEARS = Array.from({length: 2021 - 1844 + 1}, (_, i) => 1844 + i);
// z14 tiles covering Geneva: center, north, south, east, west.
const TILES = [
  [14, 8471, 5815],
  [14, 8471, 5814],
  [14, 8471, 5816],
  [14, 8472, 5815],
  [14, 8470, 5815]
];
const CONCURRENCY = 8;

async function tileHash(year, [z, x, y]) {
  const url = `https://wmts.geo.admin.ch/1.0.0/ch.swisstopo.zeitreihen/default/${year}1231/3857/${z}/${x}/${y}.png`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`);
  return createHash("md5").update(Buffer.from(await response.arrayBuffer())).digest("hex");
}

// year -> concatenated hash of all sampled tiles
const signatures = new Map();
const jobs = YEARS.flatMap((year) => TILES.map((tile, i) => ({year, tile, i})));
let next = 0;
await Promise.all(Array.from({length: CONCURRENCY}, async () => {
  while (next < jobs.length) {
    const {year, tile, i} = jobs[next++];
    const hash = await tileHash(year, tile);
    const parts = signatures.get(year) ?? [];
    parts[i] = hash;
    signatures.set(year, parts);
  }
}));

const editions = YEARS.filter((year, index) => {
  if (index === 0) return true;
  return signatures.get(year).join() !== signatures.get(YEARS[index - 1]).join();
});

writeFileSync(OUT_PATH, JSON.stringify(editions) + "\n");
console.log(`zeitreise-editions: ${editions.length} edition years out of ${YEARS.length} -> ${OUT_PATH}`);

#!/usr/bin/env node
// Builds the layer config for the historical-basemap demo: for each swisstopo WMTS
// time-series layer of interest, takes the timestamps from the GetCapabilities and keeps
// only the years that actually have content at Geneva (blank tiles are ~668 bytes).
// Output: docs/data/swisstopo-layers.json. Usage: node scripts/swisstopo-layers.js
import {writeFileSync} from "node:fs";

const OUT_PATH = "docs/data/swisstopo-layers.json";
const CAPABILITIES = "https://wmts.geo.admin.ch/EPSG/3857/1.0.0/WMTSCapabilities.xml";
const PROBE_TILE = [14, 8471, 5815]; // Geneva center, z14
const BLANK_BYTES = 1000; // blank/no-coverage tiles are ~668 bytes
const LAYERS = [
  {id: "ch.swisstopo.pixelkarte-farbe-pk25.noscale", ext: "jpeg"},
  {id: "ch.swisstopo.swissimage-product", ext: "jpeg"}
];
const CONCURRENCY = 8;

const xml = await (await fetch(CAPABILITIES)).text();

function capabilityTimes(id) {
  const block = xml.split("<Layer>").find((b) => b.includes(`<ows:Identifier>${id}</ows:Identifier>`));
  if (!block) throw new Error(`layer ${id} not found in capabilities`);
  const dimension = block.match(/<Dimension>[^]*?<\/Dimension>/)[0];
  const currentYear = new Date().getFullYear();
  return [...dimension.matchAll(/<Value>(\d{4})<\/Value>/g)] // numeric years only (drops "current")
    .map((m) => +m[1])
    .filter((y) => y <= currentYear)
    .sort((a, b) => a - b);
}

async function hasCoverage(id, ext, year) {
  const [z, x, y] = PROBE_TILE;
  const url = `https://wmts.geo.admin.ch/1.0.0/${id}/default/${year}/3857/${z}/${x}/${y}.${ext}`;
  const response = await fetch(url);
  if (!response.ok) return false;
  return (await response.arrayBuffer()).byteLength > BLANK_BYTES;
}

const out = {};
for (const {id, ext} of LAYERS) {
  const times = capabilityTimes(id);
  const covered = [];
  let next = 0;
  await Promise.all(Array.from({length: CONCURRENCY}, async () => {
    while (next < times.length) {
      const year = times[next++];
      if (await hasCoverage(id, ext, year)) covered.push(year);
    }
  }));
  covered.sort((a, b) => a - b);
  out[id] = {ext, times: covered};
  console.log(`${id}: ${covered.length}/${times.length} years with Geneva coverage (${covered[0]}-${covered.at(-1)})`);
}

writeFileSync(OUT_PATH, JSON.stringify(out, null, 2) + "\n");
console.log(`swisstopo-layers: wrote ${OUT_PATH}`);

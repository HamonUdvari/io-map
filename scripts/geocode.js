#!/usr/bin/env node
// Geocodes unique addressOSM values from docs/data/io-map-v2.csv via Nominatim,
// caching results in docs/data/geocode-v2.json (incremental: cached keys are skipped,
// so manual corrections to the cache survive re-runs).
// Usage: node scripts/geocode.js [--retry-failed]
import {readFileSync, writeFileSync, existsSync} from "node:fs";
import {csvParse, csvFormat} from "d3-dsv";

const CSV_PATH = "docs/data/io-map-v2.csv";
const CACHE_PATH = "docs/data/geocode-v2.json";
const MISSES_PATH = "geocode-misses.csv";
const USER_AGENT = "io-map-geocoder/1.0 (claude@tib.mozmail.com)";
const RATE_LIMIT_MS = 1100; // Nominatim policy: max 1 request/second
const retryFailed = process.argv.includes("--retry-failed");

const rows = csvParse(readFileSync(CSV_PATH, "utf8"));
const cache = existsSync(CACHE_PATH) ? JSON.parse(readFileSync(CACHE_PATH, "utf8")) : {};

// Unique addresses with their query context and affected-row counts.
const addresses = new Map();
for (const row of rows) {
  const address = (row.addressOSM ?? "").trim();
  if (!address) continue;
  const entry = addresses.get(address) ?? {
    city: row.city?.trim() || "Genève",
    country: row.country?.trim() || "Switzerland",
    count: 0
  };
  entry.count++;
  addresses.set(address, entry);
}

const pending = [...addresses.keys()].filter((a) =>
  retryFailed ? !(a in cache) || cache[a] === null : !(a in cache)
);

console.log(`geocode: ${addresses.size} unique addresses, ${addresses.size - pending.length} cached, ${pending.length} to fetch`);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

let fetched = 0;
for (const address of pending) {
  const {city, country} = addresses.get(address);
  const query = `${address}, ${city}, ${country}`;
  const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=${encodeURIComponent(query)}`;
  try {
    const response = await fetch(url, {headers: {"User-Agent": USER_AGENT}});
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const results = await response.json();
    cache[address] = results.length
      ? {lat: +results[0].lat, lon: +results[0].lon, displayName: results[0].display_name}
      : null;
  } catch (error) {
    console.error(`geocode: error for ${JSON.stringify(query)}: ${error.message} (left uncached)`);
    await sleep(RATE_LIMIT_MS);
    continue;
  }
  fetched++;
  writeFileSync(CACHE_PATH, JSON.stringify(cache, null, 2)); // crash-safe incremental writes
  if (fetched % 25 === 0) console.log(`geocode: ${fetched}/${pending.length} fetched`);
  await sleep(RATE_LIMIT_MS);
}

writeFileSync(CACHE_PATH, JSON.stringify(cache, null, 2));

const misses = [...addresses.entries()]
  .filter(([address]) => cache[address] === null)
  .map(([address, {city, country, count}]) => ({
    addressOSM: address,
    query: `${address}, ${city}, ${country}`,
    affectedRows: count
  }));
writeFileSync(MISSES_PATH, csvFormat(misses) + "\n");

const hits = [...addresses.keys()].filter((a) => cache[a]).length;
console.log(`geocode: done — ${fetched} fetched this run; ${hits}/${addresses.size} resolved, ${misses.length} misses (see ${MISSES_PATH})`);

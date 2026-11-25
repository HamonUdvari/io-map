#!/usr/bin/env node
// Geocodes the unique addressOSM values of docs/data/io-map-v3.csv via Nominatim and
// caches the results in docs/data/geocode-v3.json. Incremental: cached addresses are
// skipped. Manual corrections do NOT go in the cache: put them in
// docs/data/geocode-overrides.csv, which the site applies on top of it.
// Usage: node scripts/geocode.js [--retry-failed] [--refetch-imprecise]
//   --retry-failed       fetch again the addresses that had no result
//   --refetch-imprecise  fetch again the numbered addresses that resolved to a street
// Optional contact for the Nominatim operators: GEOCODE_CONTACT=<mail or url>
import {readFileSync, writeFileSync, renameSync, existsSync} from "node:fs";
import {csvParse, csvFormat} from "d3-dsv";

const CSV_PATH = "docs/data/io-map-v3.csv";
const CACHE_PATH = "docs/data/geocode-v3.json";
const MISSES_PATH = "geocode-misses.csv";
const CONTACT = process.env.GEOCODE_CONTACT;
const USER_AGENT = `io-map-geocoder/1.1${CONTACT ? ` (${CONTACT})` : ""}`;
const RATE_LIMIT_MS = 1100; // Nominatim policy: max 1 request/second
const retryFailed = process.argv.includes("--retry-failed");
const refetchImprecise = process.argv.includes("--refetch-imprecise");

const rows = csvParse(readFileSync(CSV_PATH, "utf8"));
const cache = existsSync(CACHE_PATH) ? JSON.parse(readFileSync(CACHE_PATH, "utf8")) : {};

// "13bis, Avenue X" -> "13"; "8-14, Avenue Y" -> "8"; "Place des Alpes" -> null
const houseNumber =(address) => address.match(/^\d+/)?.[0] ?? null;

// A numbered address is precise when the result is that house, not its street.
// Entries seeded from the v2 cache have no `precision`: read it from the display name.
function isHouseLevel(address, entry) {
  const number = houseNumber(address);
  if (!number) return true; // nothing more precise to ask for
  if (!entry) return false;
  if (entry.precision) return entry.precision === "house";
  return new RegExp(`(^|, )${number}[^,]*,`).test(entry.displayName ?? "");
}

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

const pending = [...addresses.keys()].filter((a) => {
  if (!(a in cache)) return true;
  if (cache[a] === null) return retryFailed;
  return refetchImprecise && !isHouseLevel(a, cache[a]);
});

console.log(`geocode: ${addresses.size} unique addresses, ${addresses.size - pending.length} cached, ${pending.length} to fetch`);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Atomic write: never truncate the cache in place, or a crash mid-write would destroy it.
function writeCache() {
  writeFileSync(CACHE_PATH + ".tmp", JSON.stringify(cache, null, 2));
  renameSync(CACHE_PATH + ".tmp", CACHE_PATH);
}

// Nominatim often lists the street before the building. Prefer the result that
// carries the house number the address asks for.
function pick(address, results) {
  const number = houseNumber(address);
  if (number) {
    const house = results.find((r) => String(r.address?.house_number ?? "").match(/^\d+/)?.[0] === number);
    if (house) return {result: house, precision: "house"};
  }
  const first = results[0];
  return {result: first, precision: number ? (first.addresstype ?? first.type ?? "unknown") : "place"};
}

let fetched = 0;
for (const address of pending) {
  const {city, country} = addresses.get(address);
  const query = `${address}, ${city}, ${country}`;
  const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&addressdetails=1&q=${encodeURIComponent(query)}`;
  try {
    const response = await fetch(url, {headers: {"User-Agent": USER_AGENT}});
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const results = await response.json();
    if (results.length) {
      const {result, precision} = pick(address, results);
      const previous = cache[address];
      // a re-fetch replaces a cached street-level hit only with something better
      if (!previous || precision === "house" || !previous.precision) {
        cache[address] = {lat: +result.lat, lon: +result.lon, displayName: result.display_name, precision};
      }
    } else if (!(address in cache)) {
      cache[address] = null;
    }
  } catch (error) {
    console.error(`geocode: error for ${JSON.stringify(query)}: ${error.message} (left as it was)`);
    await sleep(RATE_LIMIT_MS);
    continue;
  }
  fetched++;
  writeCache(); // crash-safe incremental writes
  if (fetched % 25 === 0) console.log(`geocode: ${fetched}/${pending.length} fetched`);
  await sleep(RATE_LIMIT_MS);
}

// Stamp the entries that came from the v2 cache, so every entry states its precision.
for (const [address, entry] of Object.entries(cache)) {
  if (entry && !entry.precision) entry.precision = isHouseLevel(address, entry) ? (houseNumber(address) ? "house" : "place") : "street";
}
writeCache();

const misses = [...addresses.entries()]
  .filter(([address]) => cache[address] === null)
  .map(([address, {city, country, count}]) => ({
    addressOSM: address,
    query: `${address}, ${city}, ${country}`,
    affectedRows: count
  }));
writeFileSync(MISSES_PATH, csvFormat(misses) + "\n");

const used = [...addresses.keys()];
const hits = used.filter((a) => cache[a]).length;
const imprecise = used.filter((a) => cache[a] && !isHouseLevel(a, cache[a])).length;
console.log(`geocode: done — ${fetched} fetched this run; ${hits}/${addresses.size} resolved (${imprecise} only to a street or area), ${misses.length} misses (see ${MISSES_PATH})`);

#!/usr/bin/env node
// Audits the geocode cache against the official Swiss address register (the
// swisstopo search API) and writes geocode-audit.csv: one line for each address
// with the distance between the two sources and a flag.
// Usage: node scripts/geocode-audit.js [--apply] [--offline]
//   --apply    write the register position into the cache where the register has
//              that exact house and Nominatim found nothing, only the street, or a
//              point more than 50 m away (Nominatim's answers for one query vary
//              between its servers; the register is the official source). The
//              replaced answer stays in the entry as `replaced`.
//   --offline  no requests: report from the answers already cached
// The register answers are cached in docs/data/geocode-register-v3.json, so a
// second run only asks for new addresses.
import {readFileSync, writeFileSync, renameSync, existsSync} from "node:fs";
import {csvParse, csvFormat} from "d3-dsv";

const CSV_PATH = "docs/data/io-map-v3.csv";
const CACHE_PATH = "docs/data/geocode-v3.json";
const OVERRIDES_PATH = "docs/data/geocode-overrides.csv";
// GEOCODE_REGISTER moves the answer cache, e.g. out of a dev server's watched tree during a long run
const REGISTER_PATH = process.env.GEOCODE_REGISTER ?? "docs/data/geocode-register-v3.json";
const AUDIT_PATH = "geocode-audit.csv";
const USER_AGENT = "io-map-geocoder/1.1";
const RATE_LIMIT_MS = 3000; // geo.admin.ch fair use: 20 requests/minute
const FAR_METERS = 50; // the partners' own tolerance for a proximate location
const CANTON = [5.9, 46.05, 6.4, 46.42]; // lon/lat bbox around the canton of Geneva
const apply = process.argv.includes("--apply");
const offline = process.argv.includes("--offline");

const readJson = (path) => (existsSync(path) ? JSON.parse(readFileSync(path, "utf8")) : {});
function writeJson(path, value) {
  writeFileSync(path + ".tmp", JSON.stringify(value, null, 2));
  renameSync(path + ".tmp", path);
}

const fold = (s) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").trim();

// "13bis, Avenue X, Quarter" -> {number: "13bis", street: "Avenue X"}; a range
// ("8-14") asks for its first number and is marked as a range. Addresses
// without a leading number ("Place des Alpes", "Octogone 1A, Route Y") cannot
// be checked: null.
function parse(address) {
  const parts = address.split(",").map((s) => s.trim());
  const m = parts[0].match(/^(\d+)\s?([a-zA-Z]{1,4})?(\s?[-–/]\s?\d+\s?[a-zA-Z]{0,4})?$/);
  if (!m || parts.length < 2) return null;
  return {number: (m[1] + (m[2] ?? "")).toLowerCase(), street: parts[1], range: m[3] != null};
}

function haversineMeters(lat1, lon1, lat2, lon2) {
  const toRad = (x) => (x * Math.PI) / 180;
  const a = Math.sin(toRad(lat2 - lat1) / 2) ** 2
    + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(toRad(lon2 - lon1) / 2) ** 2;
  return 2 * 6371000 * Math.asin(Math.sqrt(a));
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const rows = csvParse(readFileSync(CSV_PATH, "utf8"));
const addresses = new Map(); // addressOSM -> {rows, organisations}
for (const row of rows) {
  const address = (row.addressOSM ?? "").trim();
  if (!address) continue;
  const entry = addresses.get(address) ?? {rows: 0, organisations: new Set()};
  entry.rows++;
  entry.organisations.add(row.uniqueName);
  addresses.set(address, entry);
}

// 1. Ask the register for every numbered address it has not answered yet.
const register = readJson(REGISTER_PATH);
const pending = [...addresses.keys()].filter((a) => parse(a) && !(a in register));
console.log(`geocode-audit: ${addresses.size} addresses, ${pending.length} to ask the register${offline ? " (offline: skipped)" : ""}`);

let asked = 0;
for (const address of offline ? [] : pending) {
  const {number, street} = parse(address);
  const url = "https://api3.geo.admin.ch/rest/services/api/SearchServer?type=locations&origins=address&limit=20"
    + `&searchText=${encodeURIComponent(`${street} ${number}`)}`;
  try {
    const response = await fetch(url, {headers: {"User-Agent": USER_AGENT}});
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const {results = []} = await response.json();
    // `detail` reads "<street> <number> <zip> <locality> <bfs> <commune> ch <canton>"
    const wanted = `${fold(street)} ${number} `;
    register[address] = results
      .map((r) => r.attrs)
      .filter((a) => a.detail?.startsWith(wanted) && a.detail.endsWith(" ch ge"))
      .map((a) => ({lat: a.lat, lon: a.lon, label: a.label.replace(/<[^>]+>/g, "")}));
  } catch (error) {
    console.error(`geocode-audit: error for ${JSON.stringify(address)}: ${error.message} (will ask again)`);
    await sleep(RATE_LIMIT_MS);
    continue;
  }
  asked++;
  writeJson(REGISTER_PATH, register);
  if (asked % 25 === 0) console.log(`geocode-audit: ${asked}/${pending.length} asked`);
  await sleep(RATE_LIMIT_MS);
}

// 2. Compare. The cache is read now, not at start: the geocoder may have run meanwhile.
const cache = readJson(CACHE_PATH);
const overrides = new Map(
  existsSync(OVERRIDES_PATH) ? csvParse(readFileSync(OVERRIDES_PATH, "utf8")).map((d) => [d.addressOSM.trim(), d]) : []
);

const inCanton = (lat, lon) => lon >= CANTON[0] && lon <= CANTON[2] && lat >= CANTON[1] && lat <= CANTON[3];
const report = [];
let applied = 0;

for (const [address, usage] of addresses) {
  const parsed = parse(address);
  let entry = cache[address] ?? null;
  const candidates = register[address] ?? [];
  // the same street name can exist in several communes: take the candidate
  // nearest to the geocoder's answer; without one, only a single candidate is safe
  let match = null;
  if (entry && candidates.length) {
    match = candidates
      .map((c) => ({...c, meters: haversineMeters(entry.lat, entry.lon, c.lat, c.lon)}))
      .sort((a, b) => a.meters - b.meters)[0];
    // an entry already taken from the register: report how far the geocoder was
    if (entry.replaced) match.meters = haversineMeters(entry.replaced.lat, entry.replaced.lon, match.lat, match.lon);
  } else if (candidates.length === 1) {
    match = {...candidates[0], meters: null};
  }

  const houseLevel = entry?.precision === "house";
  const before = entry; // what the geocoder said, for the report
  const useRegister = (fixedFlag) => {
    entry = cache[address] = {
      lat: match.lat, lon: match.lon, displayName: match.label, precision: "house", source: "swisstopo",
      ...(before && {replaced: {lat: before.lat, lon: before.lon, displayName: before.displayName, precision: before.precision}})
    };
    applied++;
    return fixedFlag;
  };
  let flag;
  if (overrides.has(address)) flag = "override";
  else if (!parsed) flag = entry ? "unnumbered" : "miss";
  else if (entry?.source === "swisstopo") flag = entry.replaced?.precision === "house" ? "fixed-far-from-register" : "fixed-from-register";
  else if (match && (!entry || !houseLevel) && (match.meters == null || candidates.length === 1 || match.meters <= 500)) {
    // Nominatim missed the house; the register has it
    flag = apply ? useRegister("fixed-from-register") : "register-has-house";
  }
  else if (!entry) flag = candidates.length > 1 ? "miss-ambiguous" : "miss";
  else if (!houseLevel) flag = "street-level";
  else if (!match) flag = "not-in-register";
  else if (match.meters > FAR_METERS) {
    // both name the house but disagree: with one candidate in the canton the
    // register is unambiguous; with several, a person must look. A range
    // ("8-14") is a site with several entrances: the register only knows its
    // first number, so the geocoder's answer for the whole site stays.
    if (parsed.range) flag = "far-range";
    else flag = candidates.length === 1 ? (apply ? useRegister("fixed-far-from-register") : "far") : "far-ambiguous";
  }
  else flag = "ok";

  const position = overrides.get(address) ?? entry;
  if (position && !inCanton(+position.lat, +position.lon)) flag = `${flag}+outside-canton`;

  report.push({
    addressOSM: address,
    rows: usage.rows,
    organisations: usage.organisations.size,
    flag,
    lat: position?.lat ?? "",
    lon: position?.lon ?? "",
    precision: overrides.has(address) ? "override" : (entry?.precision ?? ""),
    source: overrides.has(address) ? "override" : entry ? (entry.source ?? "nominatim") : "",
    registerLat: match?.lat ?? "",
    registerLon: match?.lon ?? "",
    registerLabel: match?.label ?? "",
    registerCandidates: candidates.length,
    metersApart: match?.meters != null ? Math.round(match.meters) : "",
    geocoderLat: (entry?.replaced ?? before)?.lat ?? "",
    geocoderLon: (entry?.replaced ?? before)?.lon ?? "",
    geocoderResult: (entry?.replaced ?? before)?.displayName ?? ""
  });
}

if (apply && applied) writeJson(CACHE_PATH, cache);

// worst first: what a person should look at is at the top
const order = ["miss", "miss-ambiguous", "far-ambiguous", "street-level", "far", "far-range", "register-has-house", "fixed-far-from-register", "not-in-register", "unnumbered", "fixed-from-register", "override", "ok"];
const rank = (flag) => { const i = order.indexOf(flag.split("+")[0]); return (flag.includes("+") ? -1 : 0) + (i < 0 ? order.length : i); };
report.sort((a, b) => rank(a.flag) - rank(b.flag) || b.rows - a.rows);
writeFileSync(AUDIT_PATH, csvFormat(report) + "\n");

const counts = new Map();
for (const r of report) counts.set(r.flag, (counts.get(r.flag) ?? 0) + 1);
console.log(`geocode-audit: ${asked} asked this run${apply ? `, ${applied} cache entries fixed from the register` : ""}; see ${AUDIT_PATH}`);
for (const [flag, n] of [...counts].sort((a, b) => b[1] - a[1])) console.log(`  ${String(n).padStart(5)}  ${flag}`);

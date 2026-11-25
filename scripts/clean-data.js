#!/usr/bin/env node
// Cleans the raw CSV extracted from the partners' xlsx (via in2csv) for the site.
// Usage: in2csv --sheet ALL RevisedDataset.xlsx | node scripts/clean-data.js > docs/data/io-map-v3.csv
// The report of everything it changed or could not resolve goes to stderr.
import {text} from "node:stream/consumers";
import {csvParse, csvFormat} from "d3-dsv";

// Explicit allowlist (input header → output header). Cells in any other column
// are dropped and listed in the report.
const COLUMNS = new Map([
  ["year", "year"],
  ["filterCategory", "filterCategory"],
  ["filterRegion", "filterRegion"],
  ["filterAffiliation", "filterAffiliation"],
  ["filterIOType", "filterIOType"],
  ["uniqueName", "uniqueName"],
  ["nameEN", "nameEN"],
  ["nameFR", "nameFR"],
  ["addressOSM", "addressOSM"],
  ["addressInfoboxDisplay", "addressInfoboxDisplay"],
  ["location/building", "locationBuilding"],
  ["city", "city"],
  ["country", "country"],
  ["representativeName", "representativeName"],
  ["event", "event"],
  ["notesEN", "notesEN"],
  ["notesFR", "notesFR"],
  ["description", "description"]
]);

// Free-text columns keep their inner line breaks; every other column is one line.
const MULTILINE = new Set(["notesEN", "notesFR", "description"]);

// Normalization maps; keys are lowercased + trimmed input values.
const EVENTS = new Map([
  ["addresschange", "addressChange"],
  ["address change", "addressChange"],
  ["namechange", "nameChange"],
  ["representativechange", "representativeChange"],
  ["closed", "closed"],
  ["established", "established"],
  ["reopened", "reopened"],
  ["informationunavailable", "informationUnavailable"],
  ["nochange", ""]
]);

const CATEGORIES = new Map([
  ["permanent representation", "Permanent Representation"],
  ["international organisation", "International Organisation"],
  ["non-governmental organisation", "Non-governmental Organisation"],
  ["special category", "Special Category"]
]);

const IO_TYPES = new Map([
  ["un system", "UN System"],
  ["un-related", "UN-related"],
  ["special status", "Special Status"],
  ["mixed", "Mixed"]
]);

// The sheet writes this placeholder where an address is unknown; it is not an address.
const NO_ADDRESS = "informationunavailable";

const report = [];
const note = (line) => report.push(line);
const unmapped = new Map();

function normalize(map, value, column) {
  const key = value.toLowerCase();
  if (!key) return "";
  if (map.has(key)) return map.get(key);
  const id = `${column}: ${JSON.stringify(value)}`;
  unmapped.set(id, (unmapped.get(id) ?? 0) + 1);
  return value;
}

const clean = (value, column) =>
  MULTILINE.has(column)
    ? (value ?? "").trim()
    : (value ?? "").replace(/\s+/g, " ").trim();

const raw = csvParse(await text(process.stdin));

for (const column of COLUMNS.keys()) {
  if (!raw.columns.includes(column)) {
    process.stderr.write(`error: expected column ${JSON.stringify(column)} not found in input\n`);
    process.exit(1);
  }
}

const extraColumns = raw.columns.filter((c) => !COLUMNS.has(c));
const rows = [];
const seen = new Set();
let blank = 0;
let duplicates = 0;
let respaced = 0;
let recased = 0;
let placeholderAddresses = 0;

raw.forEach((row, i) => {
  const sheetRow = i + 2; // 1-based, after the header row
  for (const column of extraColumns) {
    const value = (row[column] ?? "").trim();
    if (value) note(`stray cell: row ${sheetRow}, column ${JSON.stringify(column)}: ${JSON.stringify(value)} (${clean(row.uniqueName, "uniqueName")}, ${parseInt(row.year)})`);
  }

  const out = {};
  for (const [from, to] of COLUMNS) {
    out[to] = clean(row[from], to);
    if (!MULTILINE.has(to) && out[to] !== (row[from] ?? "")) respaced++;
  }
  if (Object.values(out).every((v) => v === "")) return void blank++;

  out.year = out.year ? String(parseInt(out.year)) : ""; // in2csv emits floats (1936.0)
  if (!out.year || !out.uniqueName) note(`incomplete row ${sheetRow}: year ${JSON.stringify(out.year)}, uniqueName ${JSON.stringify(out.uniqueName)} (kept)`);

  const event = normalize(EVENTS, out.event, "event");
  if (event !== out.event) recased++;
  out.event = event;
  out.filterCategory = normalize(CATEGORIES, out.filterCategory, "filterCategory");
  out.filterIOType = normalize(IO_TYPES, out.filterIOType, "filterIOType");

  if (out.addressOSM.toLowerCase() === NO_ADDRESS) {
    out.addressOSM = "";
    placeholderAddresses++;
  }

  const signature = JSON.stringify(Object.values(out));
  if (seen.has(signature)) return void duplicates++;
  seen.add(signature);
  rows.push(out);
});

// uniqueName is the identifier: spellings that differ only by letter case are one
// organisation. The most frequent spelling wins (first seen on a tie).
const spellings = new Map();
for (const row of rows) {
  const key = row.uniqueName.toLowerCase();
  if (!spellings.has(key)) spellings.set(key, new Map());
  const counts = spellings.get(key);
  counts.set(row.uniqueName, (counts.get(row.uniqueName) ?? 0) + 1);
}
const canonical = new Map();
for (const [key, counts] of spellings) {
  const ranked = [...counts].sort((a, b) => b[1] - a[1]);
  canonical.set(key, ranked[0][0]);
  if (ranked.length > 1) note(`uniqueName merged by letter case: ${ranked.map(([name, n]) => `${JSON.stringify(name)} (${n} rows)`).join(" + ")} -> ${JSON.stringify(ranked[0][0])}`);
}
for (const row of rows) row.uniqueName = canonical.get(row.uniqueName.toLowerCase());

for (const [id, count] of unmapped) note(`unmapped value kept as-is: ${id} (${count} rows)`);

const years = rows.map((d) => +d.year).filter(Boolean);
const organisations = new Set(rows.map((d) => d.uniqueName));
process.stderr.write(
  [
    `clean-data: ${raw.length} input rows -> ${rows.length} rows`,
    `  organisations (uniqueName): ${organisations.size}`,
    `  years: ${Math.min(...years)}-${Math.max(...years)}`,
    `  dropped: ${blank} blank rows, ${duplicates} exact duplicate rows`,
    `  cells with stray or repeated spaces fixed: ${respaced}`,
    `  event values with a corrected spelling: ${recased}`,
    `  addressOSM placeholders ("informationUnavailable") emptied: ${placeholderAddresses}`,
    `  columns ignored: ${extraColumns.length ? extraColumns.join(", ") : "none"}`,
    ...report.map((line) => `  ${line}`),
    ""
  ].join("\n")
);
process.stdout.write(csvFormat(rows, [...COLUMNS.values()]));
process.stdout.write("\n");

#!/usr/bin/env node
// Cleans the raw CSV extracted from the partners' xlsx (via in2csv) for use in the v2 notebook.
// Usage: in2csv --sheet SampleDataset SampleDataset.xlsx | node scripts/clean-data.js > docs/data/io-map-v2.csv
import {text} from "node:stream/consumers";
import {csvParse, csvFormat} from "d3-dsv";

// Explicit allowlist (input header → output header); junk columns (u…kk) are dropped.
const COLUMNS = new Map([
  ["year", "year"],
  ["filterOrgCategory", "filterOrgCategory"],
  ["filterRegion", "filterRegion"],
  ["filterAffiliation", "filterAffiliation"],
  ["filterIOType", "filterIOType"],
  ["nameEN", "nameEN"],
  ["nameFR", "nameFR"],
  ["addressOSM", "addressOSM"],
  ["addressInfoboxDisplay", "addressInfoboxDisplay"],
  ["location/building", "locationBuilding"],
  ["city", "city"],
  ["country", "country"],
  ["representativeName", "representativeName"],
  ["representativeGender", "representativeGender"],
  ["event", "event"],
  ["note1", "note1"],
  ["note2", "note2"],
  ["source1", "source1"],
  ["source 2", "source2"],
  ["Photos", "photos"]
]);

// Normalization maps; keys are lowercased + trimmed input values.
const EVENTS = new Map([
  ["addresschange", "addressChange"],
  ["address change", "addressChange"],
  ["namechange", "nameChange"],
  ["representativechange", "representativeChange"],
  ["moved", "moved"],
  ["closed", "closed"],
  ["established", "established"],
  ["vacant", "vacant"],
  ["nochange", ""]
]);

const IO_TYPES = new Map([["un system", "UN System"]]);

function normalize(map, value, column) {
  const key = value.toLowerCase().trim();
  if (!key) return "";
  if (map.has(key)) return map.get(key);
  process.stderr.write(`warning: unmapped ${column} value ${JSON.stringify(value)} (kept as-is)\n`);
  return value;
}

const raw = csvParse(await text(process.stdin));

for (const column of COLUMNS.keys()) {
  if (!raw.columns.includes(column)) {
    process.stderr.write(`error: expected column ${JSON.stringify(column)} not found in input\n`);
    process.exit(1);
  }
}

const rows = [];
for (const row of raw) {
  const out = {};
  for (const [from, to] of COLUMNS) out[to] = (row[from] ?? "").trim();
  if (Object.values(out).every((v) => v === "")) continue; // drop fully-empty rows
  out.year = out.year ? String(parseInt(out.year)) : ""; // in2csv emits floats (1936.0)
  out.event = normalize(EVENTS, out.event, "event");
  out.filterIOType = normalize(IO_TYPES, out.filterIOType, "filterIOType");
  rows.push(out);
}

process.stderr.write(`clean-data: ${raw.length} input rows -> ${rows.length} rows\n`);
process.stdout.write(csvFormat(rows, [...COLUMNS.values()]));
process.stdout.write("\n");

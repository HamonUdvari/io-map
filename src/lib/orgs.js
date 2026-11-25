// The real dataset, shared by the site and Storybook: the committed v3 CSV parsed
// once at module load (vite inlines it at build time — ~5.5 MB raw, ~300 kB gzipped;
// switch to a fetch if bundle size ever matters).
//
// Data model (dataset of 24 Nov 2026):
// - `uniqueName` is the stable identifier of an organisation. `nameEN` is the name
//   it carries in a given year (it changes over time) — display only.
// - The sheet has one row for each year an organisation is attested, plus extra
//   same-year rows for changes (listed chronologically: the later row wins).
import csvText from "../../docs/data/io-map-v3.csv?raw";
import geocodeCache from "../../docs/data/geocode-v3.json";
import overridesText from "../../docs/data/geocode-overrides.csv?raw";
import { csvParse } from "d3";
import { joinGeocode } from "../../docs/lib/io-data.js";

// Presence rule knobs.
export const PRESENCE = {
  // An organisation is shown in a year without a row when a row exists at most
  // this many years before AND another row exists later (a hole in the sources,
  // not an ending). 0 = strictly the attested years. Client call — see issue #25.
  bridgeYears: 0,
};

// explicit typing (not d3.autoType: it would turn notes like "1953" into numbers
// and "1946-50" into dates)
export const rows = csvParse(csvText, (d) => ({ ...d, year: +d.year }));

// manual pin corrections win over the geocoder cache
const overrides = Object.fromEntries(
  csvParse(overridesText).map((d) => [
    d.addressOSM.trim(),
    { lat: +d.lat, lon: +d.lon },
  ]),
);
export const geoRows = joinGeocode(rows, { ...geocodeCache, ...overrides });

// uniqueName -> year -> the organisation's state that year (last row of the year)
const statesByOrg = new Map();
for (const d of geoRows) {
  if (!statesByOrg.has(d.uniqueName)) statesByOrg.set(d.uniqueName, new Map());
  statesByOrg.get(d.uniqueName).set(d.year, d);
}

export const YEAR_MIN = Math.min(...rows.map((d) => d.year));
export const YEAR_MAX = Math.max(...rows.map((d) => d.year));

// The state of one organisation in `year`, or null when it is not present:
// no row for the year (beyond the bridge), or the year's last row closes it.
function stateIn(states, year) {
  let state = states.get(year);
  if (state == null && PRESENCE.bridgeYears > 0) {
    let later = false;
    for (const y of states.keys()) if (y > year) later = true;
    for (let y = year - 1; later && y >= year - PRESENCE.bridgeYears; y--) {
      if (states.has(y)) {
        state = states.get(y);
        break;
      }
    }
  }
  return state == null || state.event === "closed" ? null : state;
}

const presentByYear = new Map();

// One row (the state of the year) for each organisation present in `year`.
export function presentIn(year) {
  if (!presentByYear.has(year)) {
    const present = [];
    for (const states of statesByOrg.values()) {
      const state = stateIn(states, year);
      if (state != null) present.push(state);
    }
    presentByYear.set(year, present);
  }
  return presentByYear.get(year);
}

// Identifiers (uniqueName) of the organisations present in `year`.
export function organisationsIn(year) {
  return presentIn(year).map((d) => d.uniqueName);
}

// Present organisations with coordinates in `year` — the map's marker set.
// Organisations without a known address that year are present but have no point.
export function pointsIn(year) {
  return presentIn(year).filter((d) => d.lat != null && d.long != null);
}

// filterCategory -> the filter-chip / marker key; null = categoryless
const CATEGORY_KEYS = {
  "Permanent Representation": "pr",
  "International Organisation": "io",
  "Non-governmental Organisation": "ngo",
  "Special Category": "special", // the Graduate Institute and its predecessors
};

// every category key, in display order — iterate this instead of listing keys
export const CATEGORY_ORDER = ["pr", "ngo", "io", "special"];

export function categoryKey(d) {
  return CATEGORY_KEYS[d.filterCategory] ?? null;
}

// Case- and accent-insensitive contains ("comite" matches "Comité").
const fold = (s) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");

// matches the name of the year in both languages, and the identifier (so a
// former or later name of the same organisation still finds it)
export function nameMatches(d, query) {
  const q = fold(query.trim());
  return (
    q === "" ||
    fold(d.nameEN).includes(q) ||
    fold(d.nameFR ?? "").includes(q) ||
    fold(d.uniqueName ?? "").includes(q)
  );
}

// The points the map shows: geocoded orgs of the year, narrowed by the
// category chips and the name filter (shared by markers and zoom-to-fit).
export function filteredPoints(year, cats, query) {
  return pointsIn(year)
    .filter((d) => cats.length === 0 || cats.includes(categoryKey(d)))
    .filter((d) => nameMatches(d, query));
}

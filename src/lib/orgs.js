// The real dataset, shared by the site and Storybook: the committed v2 CSV parsed
// once at module load (vite inlines it at build time — ~1.2 MB; switch to a fetch
// if bundle size ever matters). Selectors reuse the notebooks' io-data logic so the
// lists show exactly what the map logic considers active.
import csvText from "../../docs/data/io-map-v2.csv?raw";
import geocode from "../../docs/data/geocode-v2.json";
import { csvParse, autoType } from "d3";
import {
  joinGeocode,
  latestStateByYear,
  plottedForYear,
} from "../../docs/lib/io-data.js";

export const rows = csvParse(csvText, autoType);
export const geoRows = joinGeocode(rows, geocode);

// Distinct organisations active in `year` (latest state per org; closed/moved drop out).
export function organisationsIn(year) {
  return latestStateByYear(rows, year)
    .map((d) => d.nameEN)
    .sort((a, b) => a.localeCompare(b));
}

// Active organisations with coordinates in `year` — the map's marker set.
export function pointsIn(year) {
  return plottedForYear(geoRows, year);
}

// filterOrgCategory -> the filter-chip / marker key; null = categoryless
const CATEGORY_KEYS = {
  "Permanent Representation": "pr",
  "International Organisation": "io",
  "Non-governmental Organisation": "ngo",
  "Sub-NGO": "ngo",
};

export function categoryKey(d) {
  return CATEGORY_KEYS[d.filterOrgCategory] ?? null;
}

// Case- and accent-insensitive contains ("comite" matches "Comité").
const fold = (s) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

export function nameMatches(d, query) {
  const q = fold(query.trim());
  return q === "" || fold(d.nameEN).includes(q);
}

// The points the map shows: geocoded orgs of the year, narrowed by the
// category chips and the name filter (shared by markers and zoom-to-fit).
export function filteredPoints(year, cats, query) {
  return pointsIn(year)
    .filter((d) => cats.length === 0 || cats.includes(categoryKey(d)))
    .filter((d) => nameMatches(d, query));
}

// Infobox data derivations: everything the InfoBox needs for one selected
// organisation, derived from the CSV rows (data layer untouched). Ported from
// the docs/infobox-content.html notebook: the "no"-aware content gate, the
// display-address-or-OSM fallback, and latest-row-at-year selection.
import {
  rows,
  pointsIn,
  filteredPoints,
  categoryKey,
  orgStateIn,
} from "./orgs.js";
import { haversineMeters, formatDistance } from "../../docs/lib/io-data.js";

// literal "no" is the sheet's explicit none placeholder
const hasContent = (s) => Boolean(s) && String(s).trim().toLowerCase() !== "no";

const PREFIXES = {
  "Permanent Representation": "PR",
  "International Organisation": "IO",
  "Non-governmental Organisation": "NGO",
};

// the sheet's placeholder for an unknown address — not an address to show
const NO_ADDRESS = "informationunavailable";
const hasAddress = (s) =>
  hasContent(s) && String(s).trim().toLowerCase() !== NO_ADDRESS;

// one organisation's rows, oldest first (stable sort: same-year rows keep the
// sheet's chronological order)
const orgRows = (id) =>
  rows.filter((d) => d.uniqueName === id).sort((a, b) => a.year - b.year);

const addressOf = (row) =>
  hasAddress(row.addressInfoboxDisplay)
    ? row.addressInfoboxDisplay
    : row.addressOSM;

const latestWith = (history, field, year) => {
  const known = history.filter((d) => d.year <= year && hasContent(d[field]));
  return known.length ? known.at(-1)[field] : null;
};

// Header/meta content for one organisation (by uniqueName), as of `year` (fields
// fall back to the latest known value so a sparse row doesn't blank the meta block).
export function orgInfo(id, year) {
  const history = orgRows(id);
  if (history.length === 0) return null;
  const row = history.filter((d) => d.year <= year).at(-1) ?? history[0];
  const at = row.year;
  // the address must come from ONE row (the latest that has any address):
  // per-row display-or-OSM, like the notebook — mixing the latest display
  // address with a newer OSM-only change would show stale streets
  const addressRow = history
    .filter(
      (d) =>
        d.year <= at &&
        (hasAddress(d.addressInfoboxDisplay) || hasAddress(d.addressOSM)),
    )
    .at(-1);
  return {
    id,
    name: row.nameEN, // the name carried in the described year
    nameFR: hasContent(row.nameFR) ? row.nameFR : null,
    category: row.filterCategory,
    key: categoryKey(row),
    prefix: PREFIXES[row.filterCategory] ?? null,
    region: hasContent(row.filterRegion) ? row.filterRegion : null,
    address: addressRow ? addressOf(addressRow) : null,
    building: latestWith(history, "locationBuilding", at),
    representative: latestWith(history, "representativeName", at),
    activity: `${history[0].year}–${history.at(-1).year}`,
    // organisation-level text: the sheet repeats or places it on any row
    description: latestWith(history, "description", Infinity),
    at, // the year the meta actually describes (latest row <= viewed year)
    firstYear: history[0].year,
    history,
  };
}

// Where the organisation stands in the viewed year — the infobox's status
// line ("show if currently closed or not"). `kind` is for styling, `label`
// the sentence. Follows the map's presence rule (orgs.js orgStateIn).
// TODO(design): wording.
/**
 * @param {string} id uniqueName
 * @param {number} year
 * @returns {{kind: "present" | "present-no-address" | "not-yet" | "closed" | "no-information" | "gap", label: string, year: number, first: number, last: number} | null}
 */
export function orgStatus(id, year) {
  const history = orgRows(id);
  if (history.length === 0) return null;
  const first = history[0].year;
  const last = history.at(-1).year;
  const base = { year, first, last };
  const state = orgStateIn(id, year);
  if (state != null) {
    const located = hasAddress(state.addressOSM);
    return {
      ...base,
      kind: located ? "present" : "present-no-address",
      label: located
        ? `Present in Geneva in ${year}`
        : `Present in Geneva in ${year} — address not known`,
    };
  }
  if (year < first) {
    return {
      ...base,
      kind: "not-yet",
      label: `Not yet in Geneva in ${year} — first recorded in ${first}`,
    };
  }
  const before = history.filter((d) => d.year <= year).at(-1);
  const after = history.find((d) => d.year > year) ?? null;
  if (before.event === "closed") {
    return {
      ...base,
      kind: "closed",
      label:
        after != null
          ? `Closed in ${before.year} — back in Geneva in ${after.year}`
          : `Closed in ${before.year}`,
    };
  }
  if (after == null) {
    return {
      ...base,
      kind: "no-information",
      label: `No information in the sources after ${before.year}`,
    };
  }
  return {
    ...base,
    kind: "gap",
    label: `Not recorded in ${year} — recorded in ${before.year} and again in ${after.year}`,
  };
}

// Humanized event titles (clients: "shouldn't read like a database"); unknown
// event strings fall through as-is (the sheet has free-text one-offs).
// `previous` is the organisation's row before this one, if any.
const eventTitle = (row, previous) => {
  switch (row.event) {
    case "addressChange":
      return hasContent(addressOf(row))
        ? `Address changed to ${addressOf(row)}`
        : "Address changed";
    case "representativeChange":
      // the sheet records a vacated seat as a representativeChange to "vacant"
      if (String(row.representativeName).trim().toLowerCase() === "vacant")
        return "Representation vacant";
      return hasContent(row.representativeName)
        ? `${row.representativeName} named new representative`
        : "New representative named";
    case "nameChange":
      return previous != null && previous.nameEN !== row.nameEN
        ? `Renamed ${row.nameEN}`
        : "Renamed";
    case "established":
      return "Established in Geneva";
    case "reopened":
      return "Reopened in Geneva";
    case "closed":
      return "Closed";
    case "informationUnavailable":
      return "No address in the sources for this year";
    default:
      return row.event;
  }
};

// The timeline, regrouped by year: same-year rows merge under one heading
// (e.g. Afghanistan 1983: address + representative change). Rows without an
// event still appear when they carry a note — the "first mention" case.
export function eventGroups(history) {
  const groups = [];
  history.forEach((row, i) => {
    const entry = {
      title: hasContent(row.event) ? eventTitle(row, history[i - 1]) : null,
      note: hasContent(row.notesEN) ? row.notesEN : null,
    };
    // yearly rows with nothing to TELL drop out: most rows only attest that
    // the organisation was there that year
    if (!entry.title && !entry.note) return;
    const group = groups.at(-1);
    if (group?.year === row.year) group.events.push(entry);
    else groups.push({ year: row.year, events: [entry] });
  });
  return groups;
}

// The year groups regrouped by decade, for the collapsible timeline
// (clients: with many changes the list is too long to read in one piece).
export function decadeGroups(groups) {
  const decades = [];
  for (const group of groups) {
    const decade = Math.floor(group.year / 10) * 10;
    if (decades.at(-1)?.decade !== decade)
      decades.push({ decade, label: `${decade}s`, groups: [] });
    decades.at(-1).groups.push(group);
  }
  return decades;
}

// Nearest organisations for the table (Figma right-side info): every org
// within `radius` meters — or the `min` closest when the neighbourhood is
// sparser than that — among the orgs the GLOBAL filters allow (category
// chips + name query, like the map). The selected org itself anchors from
// the unfiltered set, so filters never orphan it. "same addr." under a
// metre.
/**
 * @param {string} id uniqueName
 * @param {number} year
 * @param {{cats?: string[], query?: string, radius?: number, min?: number}} [options]
 */
export function nearestTo(
  id,
  year,
  { cats = [], query = "", radius = 500, min = 5 } = {},
) {
  const self = pointsIn(year).find((d) => d.uniqueName === id);
  if (!self) return [];
  // distances from self only (O(n)) — io-data's nearestNeighbors builds the
  // full all-pairs map, too slow to run per render during a year drag
  const sorted = filteredPoints(year, cats, query)
    .filter((d) => d.uniqueName !== id)
    .map((point) => ({
      point,
      meters: haversineMeters(self.lat, self.long, point.lat, point.long),
    }))
    .sort(
      (a, b) =>
        a.meters - b.meters || (a.point.nameEN < b.point.nameEN ? -1 : 1),
    );
  const within = sorted.filter((n) => n.meters <= radius);
  return (within.length >= min ? within : sorted.slice(0, min)).map(
    ({ point, meters }) => ({
      id: point.uniqueName,
      name: point.nameEN,
      category: categoryKey(point),
      right: meters < 1 ? "same addr." : formatDistance(meters),
    }),
  );
}

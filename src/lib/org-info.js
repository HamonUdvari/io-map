// Infobox data derivations: everything the InfoBox needs for one selected
// organisation, derived from the CSV rows (data layer untouched). Ported from
// the docs/infobox-content.html notebook: the "no"-aware content gate, the
// display-address-or-OSM fallback, and latest-row-at-year selection.
import { rows, pointsIn, filteredPoints, categoryKey } from "./orgs.js";
import { haversineMeters, formatDistance } from "../../docs/lib/io-data.js";

// literal "no" is the sheet's explicit none placeholder
const hasContent = (s) => Boolean(s) && String(s).trim().toLowerCase() !== "no";

const PREFIXES = {
  "Permanent Representation": "PR",
  "International Organisation": "IO",
  "Non-governmental Organisation": "NGO",
  "Sub-NGO": "Sub-NGO",
};

const orgRows = (name) =>
  rows.filter((d) => d.nameEN === name).sort((a, b) => a.year - b.year);

const addressOf = (row) =>
  hasContent(row.addressInfoboxDisplay)
    ? row.addressInfoboxDisplay
    : row.addressOSM;

const latestWith = (history, field, year) => {
  const known = history.filter((d) => d.year <= year && hasContent(d[field]));
  return known.length ? known.at(-1)[field] : null;
};

// Header/meta content for one organisation, as of `year` (fields fall back to
// the latest known value so a sparse row doesn't blank the meta block).
export function orgInfo(name, year) {
  const history = orgRows(name);
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
        (hasContent(d.addressInfoboxDisplay) || hasContent(d.addressOSM)),
    )
    .at(-1);
  return {
    name,
    nameFR: hasContent(row.nameFR) ? row.nameFR : null,
    category: row.filterOrgCategory,
    key: categoryKey(row),
    prefix: PREFIXES[row.filterOrgCategory] ?? null,
    region: hasContent(row.filterRegion) ? row.filterRegion : null,
    address: addressRow ? addressOf(addressRow) : null,
    building: latestWith(history, "locationBuilding", at),
    representative: latestWith(history, "representativeName", at),
    activity: `${history[0].year}–${history.at(-1).year}`,
    at, // the year the meta actually describes (latest row <= viewed year)
    firstYear: history[0].year,
    history,
  };
}

// Humanized event titles (clients: "shouldn't read like a database"); unknown
// event strings fall through as-is (the sheet has free-text one-offs).
const eventTitle = (row) => {
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
      return "Renamed";
    case "nameChangeFR":
      return "French name changed";
    case "established":
      return "Established in Geneva";
    case "closed":
      return "Closed";
    case "moved":
      return "Moved away from Geneva";
    case "vacant":
      return "Representation vacant";
    default:
      return row.event;
  }
};

// source1/source2 -> render refs: URLs become labelled links, Blue Book codes
// stay plain text, "no"/empty drop out.
const SOURCE_LABELS = [["archives.ungeneva.org", "UN Archives"]];

export function sourceRefs(row) {
  return [row.source1, row.source2].filter(hasContent).map((s) => {
    const v = String(s).trim();
    try {
      if (/^https?:\/\//.test(v)) {
        const host = new URL(v).hostname;
        const label =
          SOURCE_LABELS.find(([h]) => host.endsWith(h))?.[1] ?? host;
        return { label, href: v };
      }
    } catch {
      // hand-edited sheet — a malformed URL must not blank the infobox
    }
    return { label: v };
  });
}

// The timeline, regrouped by year: same-year rows merge under one heading
// (e.g. Afghanistan 1983: address + representative change). Rows without an
// event still appear when they carry a note — the "first mention" case.
// TODO(design): clients eventually want collapsible decade grouping on top.
export function eventGroups(history) {
  const groups = [];
  for (const row of history) {
    const entry = {
      title: hasContent(row.event) ? eventTitle(row) : null,
      note: hasContent(row.note1) ? row.note1 : null,
      note2: hasContent(row.note2) ? row.note2 : null,
      sources: sourceRefs(row),
    };
    // yearly rows with nothing to TELL drop out — deliberately including the
    // ~34% attestation-only rows (a source but no event/note); listing every
    // Blue Book attestation would drown the curated timeline. Client call.
    if (!entry.title && !entry.note && !entry.note2) continue;
    const group = groups.at(-1);
    if (group?.year === row.year) group.events.push(entry);
    else groups.push({ year: row.year, events: [entry] });
  }
  return groups;
}

// Nearest organisations for the table (Figma right-side info): every org
// within `radius` meters — or the `min` closest when the neighbourhood is
// sparser than that — among the orgs the GLOBAL filters allow (category
// chips + name query, like the map). The selected org itself anchors from
// the unfiltered set, so filters never orphan it. "same addr." under a
// metre.
/**
 * @param {string} name
 * @param {number} year
 * @param {{cats?: string[], query?: string, radius?: number, min?: number}} [options]
 */
export function nearestTo(
  name,
  year,
  { cats = [], query = "", radius = 500, min = 5 } = {},
) {
  const self = pointsIn(year).find((d) => d.nameEN === name);
  if (!self) return [];
  // distances from self only (O(n)) — io-data's nearestNeighbors builds the
  // full all-pairs map, too slow to run per render during a year drag
  const sorted = filteredPoints(year, cats, query)
    .filter((d) => d.nameEN !== name)
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
      name: point.nameEN,
      category: categoryKey(point),
      right: meters < 1 ? "same addr." : formatDistance(meters),
    }),
  );
}

// TODO remove: demo-only infobox content for Afghanistan until the client
// columns (descriptions, contemporary web links, photos + credits) land.
const DEMO_CONTENT = {
  Afghanistan: {
    about:
      "Afghanistan maintained a permanent delegation to the League of " +
      "Nations in Geneva from 1936, opened in the wake of the Conference " +
      "on Disarmament. Closed at the outbreak of the Second World War, " +
      "the representation returned to Geneva in 1983 and remained active " +
      "through the United Nations era.",
    photo: {
      src: "https://upload.wikimedia.org/wikipedia/commons/thumb/7/73/Palais_des_nations.jpg/960px-Palais_des_nations.jpg",
      alt: "Palais des Nations, Geneva",
      credit: "Photo: Wikimedia Commons, CC BY-SA",
    },
    url: "https://www.ungeneva.org/en/blue-book/missions/member-states",
  },
};

export function demoContent(name) {
  return DEMO_CONTENT[name] ?? null;
}

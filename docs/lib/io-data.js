// Shared data helpers for the v3 notebooks: the dataset join/dedup logic extracted from
// docs/io-map-v2.html, plus geometry utilities for the point overlays.

export function joinGeocode(rows, geocode) {
  return rows.map(d => {
    const hit = geocode[String(d.addressOSM ?? "").trim()];
    return {...d, lat: hit?.lat, long: hit?.lon};
  });
}

// Latest known state per organisation up to `year`. Same-year rows are listed
// chronologically in the sheet, so later rows win ties (>=). Organisations whose latest
// event is "closed" or "moved" (relocated outside Geneva) are not shown.
export function latestStateByYear(rows, year) {
  const latest = {};
  for (const d of rows) {
    if (!d.year || d.year > year) continue;
    if (!latest[d.nameEN] || d.year >= latest[d.nameEN].year) latest[d.nameEN] = d;
  }
  return Object.values(latest).filter(d => d.event !== "closed" && d.event !== "moved");
}

export function plottedForYear(rows, year) {
  return latestStateByYear(rows, year).filter(d => d.lat != null && d.long != null);
}

export const CATEGORY_COLORS = {
  "Permanent Representation": "#4269d0",
  "International Organisation": "#efb118",
  "Non-governmental Organisation": "#ff725c",
  "Sub-NGO": "#ff725c"
};

export function categoryColor(d) {
  return CATEGORY_COLORS[d.filterOrgCategory] ?? "#999999";
}

export function haversineMeters(lat1, lon1, lat2, lon2) {
  const toRad = x => (x * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * 6371000 * Math.asin(Math.sqrt(a));
}

// Members sorted by name so spread offsets are stable across renders.
export function groupByCoordinate(points) {
  const stacks = new Map();
  for (const d of points) {
    const key = `${d.lat},${d.long}`;
    if (!stacks.has(key)) stacks.set(key, []);
    stacks.get(key).push(d);
  }
  for (const members of stacks.values()) {
    members.sort((a, b) => (a.nameEN < b.nameEN ? -1 : a.nameEN > b.nameEN ? 1 : 0));
  }
  return stacks;
}

// Deterministic spaced jitter for n coincident points, after
// https://observablehq.com/@jtrim-ons/avoiding-overlaps-in-jitter-plots: random-looking
// offsets in a disc around the true location, but each point is placed with Mitchell's
// best-candidate rule (pick the candidate farthest from everyone already placed), so the
// cloud flows freely without dots piling up. Seeded PRNG — same input, same layout, no
// reshuffling between renders.
export function stackOffsets(n, radius) {
  if (n === 1) return [[0, 0]];
  const random = mulberry32(0x9e3779b9 ^ n);
  const R = Math.max(radius, 0.75 * radius * Math.sqrt(n)); // cloud area grows with the stack
  const points = [];
  for (let i = 0; i < n; i++) {
    let best = null;
    let bestScore = -1;
    for (let c = 0; c < 40; c++) {
      const a = random() * 2 * Math.PI;
      const r = R * Math.sqrt(random());
      const candidate = [r * Math.cos(a), r * Math.sin(a)];
      let score = Infinity;
      for (const p of points) score = Math.min(score, Math.hypot(p[0] - candidate[0], p[1] - candidate[1]));
      if (score > bestScore) { bestScore = score; best = candidate; }
    }
    points.push(best);
  }
  return points;
}

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// For each point, its k nearest other points (haversine). Same-coordinate stack-mates
// come first at 0 m.
export function nearestNeighbors(points, k) {
  const result = new Map();
  for (const p of points) {
    const ds = [];
    for (const q of points) {
      if (q === p) continue;
      ds.push({point: q, meters: haversineMeters(p.lat, p.long, q.lat, q.long)});
    }
    ds.sort((a, b) => a.meters - b.meters || (a.point.nameEN < b.point.nameEN ? -1 : 1));
    result.set(p, ds.slice(0, k));
  }
  return result;
}

export function toFeatures(points) {
  return points.map(d => ({
    type: "Feature",
    geometry: {type: "Point", coordinates: [d.long, d.lat]},
    properties: d
  }));
}

export function formatDistance(m) {
  return m < 1 ? "0 m" : m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(1)} km`;
}

export function escapeHtml(s) {
  return String(s ?? "").replace(/[&<>"']/g, c =>
    ({"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"})[c]);
}

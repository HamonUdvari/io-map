// Idle basemap warming: once the camera and the year settle, silently fetch
// tile images the user is likely to need next. The service worker
// (public/sw.js) stores every tile in Cache Storage, so warming persists
// across reloads and visits — each idle run continues where the last ended
// until the whole timeline is local.
//
// Priority order (a budgeted trickle, nearest need first):
//   1. the CURRENT edition one zoom level in and out of the viewport
//   2. other editions outward from the current year (nearest first) at the
//      current viewport+zoom — "scrub the timeline here" warming
//   3. EVERYTHING, eventually: the whole points area for every edition,
//      low zooms first up to areaMaxZoom — full-timeline coverage at
//      overview-to-city zooms, wherever the camera goes next
// The current edition's ±1 zoom and the nearest `prebakeNeighbors` editions
// warm through tonedTileHref (pre-BAKED — they paint instantly); the rest
// fill the tile cache only.
//
// Every run downloads in budget-sized chunks (NETWORK bytes — already-
// cached tiles skip for free) with a rest between chunks, and continues
// itself until the whole task list is cached. Camera or year activity
// aborts it mid-flight (MapCanvas calls abortPreload); the next idle
// re-queues from the new state. All silent, all fire-and-forget.
import { tile as d3tile, tileWrap } from "npm:d3-tile";
import { basemapForYear } from "../../docs/lib/geneva-map.js";
import { tonedTileHref } from "./tile-tone.js";
import { geoRows } from "./orgs.js";

// The tuning knobs — how much to warm and how long to wait after activity.
export const PRELOAD_PARAMS = {
  idleDelay: 600, // ms of camera/year quiet before warming starts
  budgetMB: 150, // network MB per chunk (cache hits cost nothing)
  restDelay: 10_000, // ms pause between chunks — the trickle continues itself
  concurrency: 6, // parallel tile fetches
  prebakeNeighbors: 2, // editions on each side warmed through the tone bake
  // bake at most this many tiles per run: tile-tone's LRU holds 400 and the
  // tiles the map currently displays must survive it (evicting an in-use
  // tile leaks its blob URL and undoes the warming this run just did)
  prebakeMax: 300,
  minZoom: 7, // the swisstopo tile matrices the map uses
  maxZoom: 18,
  // tier 3 sweeps the whole points area for ALL editions up to this zoom
  // (~115 tiles/edition ≈ 0.5–1.5GB total); each step deeper roughly
  // quadruples that — the viewport tiers cover the deep zooms on demand
  areaMaxZoom: 14,
};

// mirrors public/sw.js — the Cache Storage bucket the service worker fills
const TILE_CACHE = "io-map-tiles-v1";

// Every year the basemap actually changes: Zeitreise editions until the
// national map has Geneva coverage, then the pk25 editions — the same rule
// basemapForYear applies.
function basemapTimes({ editions, layersData }) {
  const pk25 = layersData["ch.swisstopo.pixelkarte-farbe-pk25.noscale"];
  return [
    ...editions.filter((t) => t < pk25.times[0]),
    ...pk25.times.map(Number),
  ].sort((a, b) => a - b);
}

// edition years ordered by distance from the current one (itself first,
// then alternating after/before) — the "nearest need first" order every
// tier walks the timeline in
function editionsOutward(times, i) {
  const out = [times[i]];
  for (let d = 1; d < times.length; d++) {
    if (i + d < times.length) out.push(times[i + d]);
    if (i - d >= 0) out.push(times[i - d]);
  }
  return out;
}

// the tiles covering the CURRENT viewport — the same d3-tile math the
// factory renders with; `factor` rescales around the viewport center
// (2 = one zoom level in, 0.5 = one out)
function viewportTiles(map, factor = 1) {
  const { width, height } = map.svg.node().viewBox.baseVal;
  const t = map.transform();
  const tiles = d3tile()
    .extent([
      [0, 0],
      [width, height],
    ])
    .tileSize(256)
    .clampX(false)
    .scale(t.k * factor)
    .translate([
      width / 2 - (width / 2 - t.x) * factor,
      height / 2 - (height / 2 - t.y) * factor,
    ])();
  const z = tiles.length > 0 ? tiles[0][2] : -1;
  if (z < PRELOAD_PARAMS.minZoom || z > PRELOAD_PARAMS.maxZoom) return [];
  return tiles;
}

// the geocoded points' bounding box (all years), padded 10% a side — the
// area tier 3 sweeps for every edition
let area = null;
function areaBbox() {
  if (area != null) return area;
  const pts = geoRows.filter(
    (d) => Number.isFinite(d.lat) && Number.isFinite(d.long),
  );
  const w = Math.min(...pts.map((d) => d.long));
  const e = Math.max(...pts.map((d) => d.long));
  const s = Math.min(...pts.map((d) => d.lat));
  const n = Math.max(...pts.map((d) => d.lat));
  const px = (e - w) * 0.1;
  const py = (n - s) * 0.1;
  area = [w - px, s - py, e + px, n + py];
  return area;
}

// slippy tile coordinates (EPSG:3857, the swisstopo layers' scheme)
const lonX = (lon, z) => ((lon + 180) / 360) * 2 ** z;
const latY = (lat, z) =>
  ((1 - Math.asinh(Math.tan((lat * Math.PI) / 180)) / Math.PI) / 2) * 2 ** z;
function areaTiles(z) {
  const [w, s, e, n] = areaBbox();
  const x0 = Math.floor(lonX(w, z));
  const x1 = Math.floor(lonX(e, z));
  const y0 = Math.floor(latY(n, z)); // north edge = smaller y
  const y1 = Math.floor(latY(s, z));
  const tiles = [];
  for (let x = x0; x <= x1; x++)
    for (let y = y0; y <= y1; y++) tiles.push([x, y, z]);
  return tiles;
}

// URLs the service worker already stores — one keys() sweep per run beats
// a caches.match round-trip per tile. Empty on http (no service worker).
async function cachedUrls() {
  try {
    const cache = await caches.open(TILE_CACHE);
    return new Set((await cache.keys()).map((r) => r.url));
  } catch {
    return new Set();
  }
}

const warmed = new Set(); // per-session guard — never re-check a warmed URL
let active = null; // the running queue's AbortController (one at a time)
let restPending = 0; // the between-chunks continuation timer

// camera/year activity calls this; the aborted run's unfinished tiles are
// simply re-queued by the next idle
export function abortPreload() {
  active?.abort();
  active = null;
  clearTimeout(restPending);
}

export function preloadBasemaps(map, year, { editions, layersData }) {
  if (navigator.connection?.saveData) return; // respect data-saver mode
  abortPreload();

  // build the prioritized task list: {url, bake} in fetch order, unique;
  // bakes past prebakeMax degrade to plain fetches (LRU protection)
  const tasks = [];
  const queued = new Set();
  let bakes = 0;
  const push = (layer, tiles, bake) => {
    for (const t of tiles) {
      const url = layer.url(...tileWrap(t));
      if (queued.has(url) || warmed.has(url)) continue;
      queued.add(url);
      const baked = bake && bakes < PRELOAD_PARAMS.prebakeMax;
      if (baked) bakes += 1;
      tasks.push({ url, bake: baked });
    }
  };

  const times = basemapTimes({ editions, layersData });
  const at = times.findLast((y) => y <= year) ?? times[0];
  const outward = editionsOutward(times, times.indexOf(at));
  const layerFor = (y) => basemapForYear(y, { editions, layersData });

  // 1. current edition, one zoom level in and out (baked — zoom is instant);
  //    the on-screen tiles too — on the FIRST visit they were displayed
  //    before the service worker took control, so nothing cached them
  const current = layerFor(at);
  push(current, viewportTiles(map, 2), true);
  push(current, viewportTiles(map, 0.5), true);
  push(current, viewportTiles(map), false);

  // 2. other editions at the current viewport, nearest year first; the
  //    nearest few pre-bake, the rest fill the tile cache
  const tiles = viewportTiles(map);
  outward
    .slice(1)
    .forEach((y, i) =>
      push(layerFor(y), tiles, i < PRELOAD_PARAMS.prebakeNeighbors * 2),
    );

  // 3. everything, eventually: the whole points area for every edition,
  //    shallow zooms first (broad coverage before detail)
  for (let z = PRELOAD_PARAMS.minZoom; z <= PRELOAD_PARAMS.areaMaxZoom; z++) {
    const zTiles = areaTiles(z);
    for (const y of outward) push(layerFor(y), zTiles, false);
  }

  const controller = new AbortController();
  active = controller;
  runQueue(tasks, controller.signal).then((ended) => {
    // budget spent but work remains: rest, then continue the trickle —
    // "everything" arrives in budget-sized chunks across the idle time
    if (controller.signal.aborted || ended !== "budget") return;
    clearTimeout(restPending);
    restPending = setTimeout(
      () => preloadBasemaps(map, year, { editions, layersData }),
      PRELOAD_PARAMS.restDelay,
    );
  });
}

// N workers drain the shared task list until it, the network-byte budget,
// or the abort signal ends the run. Tiles the service worker already
// stores skip for free (bakes still warm the tone LRU from the local
// copy); bytes are counted from the downloaded body. A fetch failure marks
// the URL warmed anyway so a missing tile is not retried every idle.
async function runQueue(tasks, signal) {
  const budget = PRELOAD_PARAMS.budgetMB * 1024 * 1024;
  const cached = await cachedUrls();
  let spent = 0;
  let next = 0;
  const worker = async () => {
    while (!signal.aborted && spent < budget && next < tasks.length) {
      const task = tasks[next++];
      try {
        if (!cached.has(task.url)) {
          const res = await fetch(task.url, { signal });
          spent += (await res.arrayBuffer()).byteLength;
        }
        // the bake reads the (now-)local copy and parks the toned blob in
        // tile-tone's LRU for instant display
        if (task.bake) await tonedTileHref(task.url);
        warmed.add(task.url);
      } catch (err) {
        if (err?.name !== "AbortError") warmed.add(task.url);
      }
    }
  };
  await Promise.all(
    Array.from({ length: PRELOAD_PARAMS.concurrency }, worker),
  ).catch(() => {});
  if (signal.aborted) return "aborted";
  return next < tasks.length ? "budget" : "done";
}

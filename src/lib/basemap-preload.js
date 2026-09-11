// Idle basemap warming: once the camera and the year settle, silently fetch
// tile images the user is likely to need next, so zooming and scrubbing the
// timeline paint from the browser HTTP cache instead of the network.
//
// Priority order (a budgeted trickle, nearest need first):
//   1. the CURRENT edition one zoom level in and out of the viewport
//   2. other editions outward from the current year (nearest first) at the
//      current viewport+zoom — "scrub the timeline here" warming
// The current edition's ±1 zoom and the nearest `prebakeNeighbors` editions
// warm through tonedTileHref (pre-BAKED — they paint instantly, and ~160
// entries fit the bake LRU); the rest are plain fetches (HTTP cache only).
//
// Every run is byte-budgeted and abortable: camera or year activity aborts
// the queue mid-flight (MapCanvas calls abortPreload), and the next idle
// re-queues from the new state. All silent, all fire-and-forget.
import { tile as d3tile, tileWrap } from "npm:d3-tile";
import { basemapForYear } from "../../docs/lib/geneva-map.js";
import { tonedTileHref } from "./tile-tone.js";

// The tuning knobs — how much to warm and how long to wait after activity.
export const PRELOAD_PARAMS = {
  idleDelay: 600, // ms of camera/year quiet before warming starts
  // downloaded MB per idle run — HTTP-cache hits count too, so this bounds
  // the trickle's REACH through the timeline, not strictly network use
  budgetMB: 25,
  concurrency: 6, // parallel tile fetches
  prebakeNeighbors: 2, // editions on each side warmed through the tone bake
  // bake at most this many tiles per run: tile-tone's LRU holds 400 and the
  // tiles the map currently displays must survive it (evicting an in-use
  // tile leaks its blob URL and undoes the warming this run just did)
  prebakeMax: 300,
  minZoom: 7, // the swisstopo tile matrices the map uses
  maxZoom: 18,
};

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

const warmed = new Set(); // per-session guard — never re-fetch a warmed URL
let active = null; // the running queue's AbortController (one at a time)

// camera/year activity calls this; the aborted run's unfinished tiles are
// simply re-queued by the next idle
export function abortPreload() {
  active?.abort();
  active = null;
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
  const i = times.indexOf(at);
  const layerFor = (y) => basemapForYear(y, { editions, layersData });

  // 1. current edition, one zoom level in and out (baked — zoom is instant)
  const current = layerFor(at);
  push(current, viewportTiles(map, 2), true);
  push(current, viewportTiles(map, 0.5), true);

  // 2. other editions outward from the current year, nearest first,
  //    alternating after/before; the nearest few pre-bake, the rest warm
  //    the HTTP cache only
  const tiles = viewportTiles(map);
  for (let d = 1; d < times.length; d++) {
    const bake = d <= PRELOAD_PARAMS.prebakeNeighbors;
    if (i + d < times.length) push(layerFor(times[i + d]), tiles, bake);
    if (i - d >= 0) push(layerFor(times[i - d]), tiles, bake);
  }

  const controller = new AbortController();
  active = controller;
  runQueue(tasks, controller.signal);
}

// N workers drain the shared task list until it, the byte budget, or the
// abort signal ends the run. Bytes are counted from the downloaded body
// (Content-Length is unreliable across CDNs) — HTTP-cache hits count too,
// see the budgetMB note. A fetch failure marks the URL warmed anyway so a
// missing tile is not retried every idle.
async function runQueue(tasks, signal) {
  const budget = PRELOAD_PARAMS.budgetMB * 1024 * 1024;
  let spent = 0;
  let next = 0;
  const worker = async () => {
    while (!signal.aborted && spent < budget && next < tasks.length) {
      const task = tasks[next++];
      try {
        const res = await fetch(task.url, { signal });
        spent += (await res.arrayBuffer()).byteLength;
        // the bake re-reads the fresh HTTP cache entry (same request shape)
        // and parks the toned blob in tile-tone's LRU for instant display
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
}

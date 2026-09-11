// Idle basemap warming: once the camera and the year settle, silently fetch
// the tile images of the NEIGHBORING basemap editions for the current
// viewport, so scrubbing the timeline paints from the browser HTTP cache
// instead of the network. Fire-and-forget <img> fetches; nothing renders.
import { tile as d3tile, tileWrap } from "npm:d3-tile";
import { basemapForYear } from "../../docs/lib/geneva-map.js";

// The tuning knobs — how much to warm and how long to wait after activity.
export const PRELOAD_PARAMS = {
  neighbors: 2, // basemap editions to warm on EACH side of the current one
  idleDelay: 1000, // ms of camera/year quiet before warming starts
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

const warmed = new Set(); // per-session guard — never fetch a URL twice

export function preloadBasemaps(map, year, { editions, layersData }) {
  const { neighbors } = PRELOAD_PARAMS;
  if (neighbors <= 0) return;

  // the tiles of the CURRENT viewport — the same d3-tile math the factory
  // renders with, fed from the live transform and the svg's viewBox size
  const { width, height } = map.svg.node().viewBox.baseVal;
  const t = map.transform();
  const tiles = d3tile()
    .extent([
      [0, 0],
      [width, height],
    ])
    .tileSize(256)
    .clampX(false)
    .scale(t.k)
    .translate([t.x, t.y])();

  const times = basemapTimes({ editions, layersData });
  const at = times.findLast((y) => y <= year) ?? times[0];
  const i = times.indexOf(at);
  const around = [
    ...times.slice(Math.max(0, i - neighbors), i),
    ...times.slice(i + 1, i + 1 + neighbors),
  ];

  for (const editionYear of around) {
    const layer = basemapForYear(editionYear, { editions, layersData });
    for (const tileXYZ of tiles) {
      const url = layer.url(...tileWrap(tileXYZ));
      if (warmed.has(url)) continue;
      warmed.add(url);
      // fetch (not Image): the same request shape tile-tone's bake uses, so
      // the HTTP cache entry is shared regardless of the server's CORS/Vary
      fetch(url).catch(() => {});
    }
  }
}

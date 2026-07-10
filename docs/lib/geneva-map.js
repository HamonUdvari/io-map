// v3 map system: swisstopo WMTS basemaps on a d3-tile + d3-zoom SVG map with a retained
// tile pyramid (Leaflet-style), so zooming, panning and basemap/year changes crossfade
// instead of flashing. Ported from noge7's createMap.js and extended with time-keyed
// levels: a level is one (basemap time, integer zoom) pair, and the same retention/prune
// rules that smooth a zoom also smooth a year change.
import * as d3 from "npm:d3";
import {tile as d3tile, tileWrap} from "npm:d3-tile";

const TILE_FADE = 250; // ms fade-in per tile once its image has loaded
const MAX_LEVELS = 8;  // safety valve on retained (time|z) levels while scrubbing fast

export const GENEVA = [6.1432, 46.2044];
export const PALAIS_DES_NATIONS = [6.1408064, 46.2257055];

// Unit Web-Mercator projection: screen px = transform.apply(unit(lonlat)).
const unit = d3.geoMercator().scale(1 / (2 * Math.PI)).translate([0, 0]);

export function centerTransform({center, zoom, width = 928, height = 500}) {
  const k = 256 * 2 ** zoom;
  const [ux, uy] = unit(center);
  return d3.zoomIdentity.translate(width / 2, height / 2).scale(k).translate(-ux, -uy);
}

export function bboxTransform({bbox: [w, s, e, n], pad = 0.85, width = 928, height = 500}) {
  const [x0, y0] = unit([w, n]);
  const [x1, y1] = unit([e, s]);
  const k = pad * Math.min(width / (x1 - x0), height / (y1 - y0));
  return d3.zoomIdentity.translate(width / 2, height / 2).scale(k).translate(-(x0 + x1) / 2, -(y0 + y1) / 2);
}

// A lon/lat bbox as a d3.zoom translateExtent in unit-projection coordinates,
// to clamp panning to a region (e.g. greater Geneva).
export function unitTranslateExtent([w, s, e, n]) {
  const [x0, y0] = unit([w, n]);
  const [x1, y1] = unit([e, s]);
  return [[x0, y0], [x1, y1]];
}

export const GENEVA_BBOX = [5.9, 46.05, 6.4, 46.42]; // greater Geneva, within swisstopo coverage

// The v3 basemap rule: Zeitreise map editions before the national map 1:25,000 has
// Geneva coverage (1956), the national map from then on. Notebooks load the two JSON
// files via FileAttachment and pass them in (lib modules can't use FileAttachment).
export function basemapForYear(year, {editions, layersData}) {
  const pk25 = layersData["ch.swisstopo.pixelkarte-farbe-pk25.noscale"];
  if (year < pk25.times[0]) {
    const shownYear = editions.findLast(t => t <= year) ?? editions[0];
    return wmtsLayer({label: "Map editions — Zeitreise", id: "ch.swisstopo.zeitreihen",
                      ext: "png", time: `${shownYear}1231`, shownYear, times: editions});
  }
  const shownYear = pk25.times.findLast(t => t <= year);
  return wmtsLayer({label: "National map 1:25,000", id: "ch.swisstopo.pixelkarte-farbe-pk25.noscale",
                    ext: pk25.ext, time: `${shownYear}`, shownYear, times: pk25.times});
}

function wmtsLayer({label, id, ext, time, shownYear, times}) {
  return {
    label, id, ext, time, shownYear, times,
    timeKey: `${id}/${time}`,
    url: (x, y, z) => `https://wmts.geo.admin.ch/1.0.0/${id}/default/${time}/3857/${z}/${x}/${y}.${ext}`
  };
}

export function createGenevaMap({
  width = 928,
  height = 500,
  center = GENEVA,   // lon, lat
  zoom = 15,         // initial zoom level (k = 256 · 2^zoom)
  minZoom = 7,
  maxZoom = 18,      // the swisstopo layers' tile matrices end at 18
  bw = false,
  extent = null,     // optional lon/lat bbox clamping panning (e.g. GENEVA_BBOX)
  transform = null   // optional initial transform (pass a zoomState holder's value)
} = {}) {
  const node = document.createElement("div");
  node.style.position = "relative";

  const svg = d3.create("svg")
      .attr("viewBox", [0, 0, width, height])
      .style("width", "100%")
      .style("height", "auto")
      .style("display", "block")
      .style("background", "#e8e8e8");
  node.appendChild(svg.node());

  const gTiles = svg.append("g")
      .attr("pointer-events", "none")
      .style("filter", bw ? "grayscale(1)" : null);
  const overlay = svg.append("g");

  const tip = document.createElement("div");
  tip.style.cssText = "position:absolute;pointer-events:none;display:none;"
    + "background:white;border:1px solid #ccc;border-radius:4px;padding:6px 8px;"
    + "font:12px/1.45 var(--sans-serif,sans-serif);color:#1b1e23;max-width:280px;"
    + "box-shadow:0 1px 4px rgba(0,0,0,0.2);z-index:1;";
  node.appendChild(tip);

  const tooltip = {
    show(html, event) {
      tip.innerHTML = html;
      tip.style.display = "block";
      // Position from client coordinates: the svg viewBox is scaled by CSS, so d3.pointer
      // would give viewBox units while this div lives in CSS px.
      const r = node.getBoundingClientRect();
      let x = event.clientX - r.left + 12;
      let y = event.clientY - r.top + 12;
      if (x + tip.offsetWidth > r.width) x = Math.max(0, event.clientX - r.left - 12 - tip.offsetWidth);
      if (y + tip.offsetHeight > r.height) y = Math.max(0, event.clientY - r.top - 12 - tip.offsetHeight);
      tip.style.left = `${x}px`;
      tip.style.top = `${y}px`;
    },
    hide() {
      tip.style.display = "none";
    }
  };

  const tile = d3tile()
      .extent([[0, 0], [width, height]])
      .tileSize(256)
      .clampX(false);

  let current = transform ?? centerTransform({center, zoom, width, height});
  let layer = null;      // {url, timeKey, ...} — nothing renders until the first setLayer
  let layerSeq = 0;      // bumped per effective layer change; paint order = (seq, z)
  let currentKey = null; // the level the live view targets — the only one allowed to prune
  let zooming = false;   // true during a gesture or flyTo — pruning is deferred
  let overlayDraw = null;
  let renderCb = null;

  const tileLevels = new Map(); // `${timeKey}|${z}` -> {key, timeKey, z, seq, g, url, loaded, errored, need}

  const tileSizeAt = (z, k) => k / 2 ** z;

  // Any tile [x,y,z] is positioned straight from the live transform, so every retained
  // level stays aligned and scales together while the camera moves.
  function placeTiles(sel, t) {
    sel.attr("x", d => d[0] * tileSizeAt(d[2], t.k) + t.x - t.k / 2)
       .attr("y", d => d[1] * tileSizeAt(d[2], t.k) + t.y - t.k / 2)
       .attr("width", d => tileSizeAt(d[2], t.k) + 1)  // +1px overlap hides seams
       .attr("height", d => tileSizeAt(d[2], t.k) + 1);
  }

  function sortLevels() {
    // Older layers stay under everything of the current layer; within a layer,
    // finer zooms paint on top.
    for (const lv of [...tileLevels.values()].sort((a, b) => a.seq - b.seq || a.z - b.z)) {
      gTiles.node().appendChild(lv.g.node());
    }
  }

  function levelFor(timeKey, z) {
    const key = `${timeKey}|${z}`;
    let lv = tileLevels.get(key);
    if (!lv) {
      lv = {key, timeKey, z, seq: layerSeq, g: gTiles.append("g"), url: layer.url,
            loaded: new Set(), errored: new Set(), need: null};
      tileLevels.set(key, lv);
      for (const old of [...tileLevels.values()].sort((a, b) => a.seq - b.seq || a.z - b.z)) {
        if (tileLevels.size <= MAX_LEVELS) break;
        if (old.key === key) continue;
        tileLevels.delete(old.key);
        old.g.remove();
      }
    }
    lv.seq = layerSeq; // re-claim a retained level when scrubbing back to its time
    sortLevels();
    return lv;
  }

  function pruneLevels(keepKey) {
    if (zooming) return; // keep every level (a coarse base covers intermediate frames) until the camera settles
    if (keepKey !== currentKey) return; // a stale level finishing its loads must not prune the newer one away
    const keep = tileLevels.get(keepKey);
    if (!keep || !keep.need) return;
    const settled = d => keep.loaded.has(String(d)) || keep.errored.has(String(d));
    if (!keep.need.every(settled)) return;
    if (keep.need.every(d => keep.errored.has(String(d)))) return; // nothing renderable — keep the fallbacks
    for (const [key, lv] of tileLevels) {
      if (key === keepKey) continue;
      tileLevels.delete(key);
      lv.g.transition().delay(TILE_FADE).remove(); // wait out the keep-level's fade-in
    }
  }

  // Create/refresh the level for transform `t` and request its tiles. Also used to
  // PREFETCH a flyTo destination, so the wide coarse tiles are already loading before
  // the view expands.
  function ensureTiles(t) {
    if (!layer) return null;
    const tiles = tile.scale(t.k).translate([t.x, t.y])();
    const z = tiles.length ? tiles[0][2] : 0;
    const lv = levelFor(layer.timeKey, z);
    lv.need = tiles;
    lv.g.selectAll("image").data(tiles, d => d).join(
      enter => enter.append("image")
          .style("opacity", 0)
          .on("load", function() {
            lv.loaded.add(String(d3.select(this).datum()));
            d3.select(this).interrupt().transition().duration(TILE_FADE).style("opacity", 1);
            pruneLevels(lv.key);
          })
          .on("error", function() {
            // 404 (outside coverage / past max zoom): stay invisible so lower levels show
            // through, but count as settled so pruning still converges.
            lv.errored.add(String(d3.select(this).datum()));
            pruneLevels(lv.key);
          })
          .attr("xlink:href", d => lv.url(...tileWrap(d)))
          .call(s => placeTiles(s, current)), // prefetched tiles must not draw at [0,0]
      update => update,
      exit => exit.each(d => { lv.loaded.delete(String(d)); lv.errored.delete(String(d)); }).remove()
    );
    return lv;
  }

  const invert = p => unit.invert([(p[0] - current.x) / current.k, (p[1] - current.y) / current.k]);

  function helpers() {
    const [w, n] = invert([0, 0]);
    const [e, s] = invert([width, height]);
    return {
      transform: current,
      zoomLevel: Math.log2(current.k / 256),
      project: ll => current.apply(unit(ll)),
      invert,
      bbox: [w, s, e, n],
      tooltip
    };
  }

  function render(t) {
    current = t;
    const lv = ensureTiles(t); // (flyTo prefetches via ensureTiles directly, so only render moves currentKey)
    if (lv) currentKey = lv.key;
    for (const l of tileLevels.values()) placeTiles(l.g.selectAll("image"), t);
    if (lv) pruneLevels(lv.key);
    if (overlayDraw) overlayDraw(overlay, helpers());
    if (renderCb) renderCb(helpers());
  }

  const zoomBehavior = d3.zoom()
      .scaleExtent([256 * 2 ** minZoom, 256 * 2 ** maxZoom])
      .extent([[0, 0], [width, height]])
      .on("start", () => { zooming = true; })
      .on("zoom", ({transform: t}) => render(t))
      .on("end", () => { zooming = false; render(current); }); // settle: the covered level prunes the stack
  if (extent) zoomBehavior.translateExtent(unitTranslateExtent(extent));

  svg.call(zoomBehavior).call(zoomBehavior.transform, current);

  return {
    node,
    svg,
    overlay,
    tooltip,
    setLayer(next) {
      if (layer && layer.timeKey === next.timeKey) { layer = next; return; } // e.g. a bw toggle re-ran the apply cell
      layerSeq++;
      layer = next;
      render(current); // the new time's level fades in above the old stack, which prunes once covered
    },
    setBW(on) {
      gTiles.style("filter", on ? "grayscale(1)" : null);
    },
    setOverlay(drawFn) {
      overlayDraw = drawFn;
      overlayDraw(overlay, helpers());
    },
    onRender(cb) {
      renderCb = cb;
      renderCb(helpers());
    },
    flyTo(target, {duration = 1500} = {}) {
      const t = target.bbox
        ? bboxTransform({bbox: target.bbox, pad: target.pad ?? 0.85, width, height})
        : centerTransform({center: target.center, zoom: target.zoom ?? Math.log2(current.k / 256), width, height});
      ensureTiles(t); // prefetch: the destination's tiles cover every frame of the fly
      svg.transition().duration(duration).call(zoomBehavior.transform, t);
    },
    project: ll => current.apply(unit(ll)),
    invert,
    zoomLevel: () => Math.log2(current.k / 256),
    bbox: () => helpers().bbox,
    transform: () => current,
    levels: () => [...tileLevels.values()].map(lv => ({
      timeKey: lv.timeKey, z: lv.z, seq: lv.seq,
      needed: lv.need?.length ?? 0, loaded: lv.loaded.size, errored: lv.errored.size
    }))
  };
}

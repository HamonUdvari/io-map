// The area the map can show: the footprint of every geocoded address of the
// dataset (all years) with a margin, never larger than the canton. The map
// cannot pan out of it, and cannot zoom out past the point where it covers
// the viewport ("block the zoom at the city level").
import { geoRows } from "./orgs.js";

// The tuning knobs.
export const BOUNDS_PARAMS = {
  // lon/lat bbox [w, s, e, n] around the canton of Geneva: the hard limit, and
  // the guard against a wrongly geocoded address far away stretching the area
  canton: [5.94, 46.12, 6.32, 46.37],
  pad: 0.15, // margin around the addresses, as a share of their span
  minZoom: 11, // absolute floor, whatever the viewport size
  // the whole area stays loaded at this coarse level under the live tiles
  // (about 16 tiles for each basemap edition), so zoom-out and "Show all"
  // never open onto an empty area
  baseZoom: 12,
};

function addressBounds() {
  const [cw, cs, ce, cn] = BOUNDS_PARAMS.canton;
  let w = Infinity;
  let s = Infinity;
  let e = -Infinity;
  let n = -Infinity;
  for (const d of geoRows) {
    if (d.lat == null || d.long == null) continue;
    if (d.long < cw || d.long > ce || d.lat < cs || d.lat > cn) continue;
    w = Math.min(w, d.long);
    e = Math.max(e, d.long);
    s = Math.min(s, d.lat);
    n = Math.max(n, d.lat);
  }
  if (w === Infinity) return BOUNDS_PARAMS.canton;
  const px = (e - w) * BOUNDS_PARAMS.pad;
  const py = (n - s) * BOUNDS_PARAMS.pad;
  return [
    Math.max(cw, w - px),
    Math.max(cs, s - py),
    Math.min(ce, e + px),
    Math.min(cn, n + py),
  ];
}

export const MAP_BOUNDS = addressBounds();

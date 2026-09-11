import { useEffect, useRef } from "preact/hooks";
import { effect, type Signal } from "@preact/signals-core";
import clsx from "clsx";
import {
  year as globalYear,
  categories as globalCategories,
  query as globalQuery,
  mapBbox as globalMapBbox,
  selectedOrg as globalSelectedOrg,
  zoomCommand,
} from "../lib/state.js";
import { filteredPoints } from "../lib/orgs.js";
import {
  preloadBasemaps,
  abortPreload,
  PRELOAD_PARAMS,
} from "../lib/basemap-preload.js";
import { tonedTileHref } from "../lib/tile-tone.js";
import { createGenevaMap, basemapForYear } from "../../docs/lib/geneva-map.js";
import { attachMarkers } from "../lib/markers.js";
import editions from "../../docs/data/zeitreise-editions.json";
import layersData from "../../docs/data/swisstopo-layers.json";

// The single d3 seam: mounts the imperative map factory once and never lets Preact
// touch anything below map.node. State flows in through the signals only —
// pass local ones (stories) or let them default to the site's global signals.
export default function MapCanvas({
  year = globalYear,
  categories = globalCategories,
  query = globalQuery,
  bbox = globalMapBbox,
  selected = globalSelectedOrg,
  class: className,
}: {
  year?: Signal<number>;
  categories?: Signal<string[]>;
  query?: Signal<string>;
  /** written by the map: the current viewport as a lon/lat bbox */
  bbox?: Signal<number[] | null>;
  /** read AND written: dot click selects, background click clears */
  selected?: Signal<string | null>;
  class?: string;
}) {
  const host = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // 1:1 rendering: the viewBox matches the host's pixel size, so raster
    // tiles are fetched for the true extent (no CSS upscaling blur) and the
    // marker/text sizes mean real screen px, like in the notebooks.
    const hostSize = () => {
      const r = host.current!.getBoundingClientRect();
      return {
        width: Math.round(r.width) || 928,
        height: Math.round(r.height) || 500,
      };
    };
    // the tone bakes into each tile at load (tile-tone.js) — CSS/SVG filters
    // on SVG elements are no-ops in WebKit, see the notes in global.css
    const map = createGenevaMap({ ...hostSize(), tileHref: tonedTileHref });
    host.current!.append(map.node);
    map.node.style.height = "100%"; // factory wrapper div must fill .map so the svg's 100% resolves
    map.svg
      .attr("preserveAspectRatio", "xMidYMid slice") // inert at 1:1; covers sub-px rounding
      .style("height", "100%");
    // Edition stepper — the time-scrub pattern Leaflet.TimeDimension and the
    // Esri time slider use: swap only when the incoming step is READY, hold
    // the last complete edition meanwhile, and drop intermediate steps like
    // a video scrubber. A fast year scrub therefore steps through as many
    // editions as the pipeline can paint — never a white gap, never a level
    // per crossed edition. The timeout advances past editions that cannot
    // settle (offline, coverage gaps).
    const STEP_TIMEOUT = 1200;
    let shownKey: string | null = null;
    let pendingLayer: any = null;
    let stepping = false;
    let stepTimer: ReturnType<typeof setTimeout>;
    const step = (layer: any) => {
      stepping = true;
      shownKey = layer.timeKey;
      clearTimeout(stepTimer);
      stepTimer = setTimeout(advance, STEP_TIMEOUT);
      map.setLayer(layer); // may fire onLayerReady synchronously (warm level)
    };
    const advance = () => {
      stepping = false;
      const next = pendingLayer;
      pendingLayer = null;
      if (next != null && next.timeKey !== shownKey) step(next);
      else clearTimeout(stepTimer);
    };
    map.onLayerReady(advance);
    const dispose = effect(() => {
      const layer = basemapForYear(year.value, { editions, layersData });
      if (layer.timeKey === shownKey) {
        pendingLayer = null; // scrubbed back onto the shown edition
        return;
      }
      if (stepping) {
        pendingLayer = layer; // latest wins; intermediates drop
        return;
      }
      step(layer);
    });
    const disposeMarkers = attachMarkers(map, {
      year,
      categories,
      query,
      selected,
    });
    // zoom commands from the state (zoomIn/zoomOut/zoomToFit — buttons come
    // later). Consumed on execution so a remount cannot replay the last one;
    // peek() keeps this effect from re-running on data-signal changes.
    const disposeZoom = effect(() => {
      const cmd = zoomCommand.value;
      if (cmd == null) return;
      zoomCommand.value = null;
      if (cmd.action === "in") map.zoomBy(2);
      if (cmd.action === "out") map.zoomBy(0.5);
      if (cmd.action === "center") {
        // 2x the fit/show-all pace: centering is a small hop, not a journey
        map.flyTo(
          { center: cmd.center, zoom: map.zoomLevel() },
          { duration: 400 },
        );
      }
      if (cmd.action === "fit") {
        const points = filteredPoints(
          year.peek(),
          categories.peek(),
          query.peek(),
        );
        if (points.length === 0) return;
        const w = Math.min(...points.map((d: any) => d.long));
        const e = Math.max(...points.map((d: any) => d.long));
        const s = Math.min(...points.map((d: any) => d.lat));
        const n = Math.max(...points.map((d: any) => d.lat));
        // degenerate span (single point / one shared address): center instead
        // of a division-by-zero transform
        if (e - w < 5e-4 && n - s < 5e-4) {
          map.flyTo(
            { center: [(w + e) / 2, (s + n) / 2], zoom: 17 },
            { duration: 800 },
          );
        } else {
          map.flyTo({ bbox: [w, s, e, n] }, { duration: 800 });
        }
      }
    });
    // publish the viewport bbox (debounced past the camera motion) so the
    // org table can mirror what the map shows. The bbox is CLIPPED to the
    // map area the UI does not cover — nav rows above, the drawer panel
    // (desktop, left) or sheet (mobile, bottom) — so "visible" counts mean
    // actually visible, not hidden under the UI.
    let bboxPending: ReturnType<typeof setTimeout>;
    const publishVisibleBbox = () => {
      const r = (map.svg.node() as SVGSVGElement).getBoundingClientRect();
      let { left, top, right, bottom } = r;
      const nav = document.querySelector(".nav");
      if (nav) top = Math.max(top, nav.getBoundingClientRect().bottom);
      const drawerEl = document.querySelector(".drawer");
      if (drawerEl) {
        const d = drawerEl.getBoundingClientRect();
        if (d.width < r.width * 0.9) left = Math.max(left, d.right);
        else bottom = Math.min(bottom, d.top);
      }
      if (right - left < 40 || bottom - top < 40) return; // fully covered
      const [w, n] = map.invert([left - r.left, top - r.top]);
      const [e, s] = map.invert([right - r.left, bottom - r.top]);
      bbox.value = [w, s, e, n];
    };
    const queueBboxPublish = () => {
      clearTimeout(bboxPending);
      bboxPending = setTimeout(publishVisibleBbox, 150);
    };
    map.onRender(queueBboxPublish);
    // detent changes move the occluder without any camera motion: watch the
    // drawer's data-state and republish once the 300ms detent transition is
    // over. A fixed delay, not transitionend — motion-reduce:transition-none
    // means the event never fires for reduced-motion users.
    let detentPending: ReturnType<typeof setTimeout>;
    const drawerObserver = new MutationObserver((records) => {
      if (!records.some((m) => (m.target as Element).matches(".drawer")))
        return;
      clearTimeout(detentPending);
      detentPending = setTimeout(publishVisibleBbox, 400);
    });
    drawerObserver.observe(document.body, {
      subtree: true,
      attributes: true,
      attributeFilter: ["data-state"],
    });
    // idle warming: when the camera (bbox settles after motion) and the year
    // go quiet, trickle-fetch nearby tiles (basemap-preload.js). Activity
    // aborts a running queue immediately — the next idle re-queues from the
    // new viewport/year.
    let preloadPending: ReturnType<typeof setTimeout>;
    const disposePreload = effect(() => {
      void bbox.value; // idle signal — re-arms after every camera settle
      const y = year.value;
      abortPreload();
      clearTimeout(preloadPending);
      preloadPending = setTimeout(
        () => preloadBasemaps(map, y, { editions, layersData }),
        PRELOAD_PARAMS.idleDelay,
      );
    });
    // follow host resizes (window, dvh changes, orientation), debounced to the
    // gesture end so a live drag-resize doesn't refetch tiles per frame
    let pending: ReturnType<typeof setTimeout>;
    const ro = new ResizeObserver(() => {
      clearTimeout(pending);
      pending = setTimeout(() => {
        const { width, height } = hostSize();
        map.resize(width, height);
      }, 150);
    });
    ro.observe(host.current!);
    return () => {
      ro.disconnect();
      drawerObserver.disconnect();
      clearTimeout(pending);
      clearTimeout(stepTimer);
      clearTimeout(detentPending);
      clearTimeout(bboxPending);
      clearTimeout(preloadPending);
      abortPreload();
      dispose();
      disposeZoom();
      disposePreload();
      disposeMarkers();
      map.node.remove();
    };
  }, [year, categories, query, bbox, selected]);

  return (
    <>
      <div id="map" class={clsx("map", className)} ref={host}></div>
      {/* #map-tone: the original SVG-filter tone — black & white, then a
          linear remap inverting the tones: ink (0) → light gray, paper (1) →
          the dark background; sRGB so the numbers read like CSS lightness
          values. Tune: intercept = ink lightness, intercept + slope = paper
          lightness (0.62 − 0.35 = 0.27 ≈ hsl(30deg 0% 27%)).
          RETIRED: the tone now bakes into each tile at load
          (src/lib/tile-tone.js) — WebKit neither applies CSS filters to SVG
          elements nor runs SVG filter graphs on the GPU. Kept for reference:
      <svg width="0" height="0" aria-hidden="true">
        <filter id="map-tone" color-interpolation-filters="sRGB">
          <feColorMatrix type="saturate" values="0" />
          <feComponentTransfer>
            <feFuncR type="linear" slope="-0.35" intercept="0.62" />
            <feFuncG type="linear" slope="-0.35" intercept="0.62" />
            <feFuncB type="linear" slope="-0.35" intercept="0.62" />
          </feComponentTransfer>
        </filter>
      </svg> */}
    </>
  );
}

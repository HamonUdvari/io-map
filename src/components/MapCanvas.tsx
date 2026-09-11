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
    const map = createGenevaMap(hostSize());
    host.current!.append(map.node);
    map.node.style.height = "100%"; // factory wrapper div must fill .map so the svg's 100% resolves
    map.svg
      .attr("preserveAspectRatio", "xMidYMid slice") // inert at 1:1; covers sub-px rounding
      .style("height", "100%");
    const dispose = effect(() =>
      map.setLayer(basemapForYear(year.value, { editions, layersData })),
    );
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
        map.flyTo(
          { center: cmd.center, zoom: map.zoomLevel() },
          { duration: 800 },
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
    // org table can mirror what the map shows
    let bboxPending: ReturnType<typeof setTimeout>;
    map.onRender(({ bbox: b }: { bbox: number[] }) => {
      clearTimeout(bboxPending);
      bboxPending = setTimeout(() => (bbox.value = b), 150);
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
      clearTimeout(pending);
      clearTimeout(bboxPending);
      dispose();
      disposeZoom();
      disposeMarkers();
      map.node.remove();
    };
  }, [year, categories, query, bbox, selected]);

  return (
    <>
      <div id="map" class={clsx("map", className)} ref={host}></div>
      <svg width="0" height="0" aria-hidden="true">
        {/* #map-tone: the whole map look in one filter — black & white, then a linear
            remap inverting the tones: ink (0) → light gray, paper (1) → the dark
            background. sRGB so the numbers read like CSS lightness values.
            Tune: intercept = ink lightness, intercept + slope = paper lightness
            (0.62 − 0.35 = 0.27 ≈ hsl(30deg 0% 27%)). */}
        <filter id="map-tone" color-interpolation-filters="sRGB">
          <feColorMatrix type="saturate" values="0" />
          <feComponentTransfer>
            <feFuncR type="linear" slope="-0.35" intercept="0.62" />
            <feFuncG type="linear" slope="-0.35" intercept="0.62" />
            <feFuncB type="linear" slope="-0.35" intercept="0.62" />
          </feComponentTransfer>
        </filter>
      </svg>
    </>
  );
}

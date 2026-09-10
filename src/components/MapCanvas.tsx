import { useEffect, useRef } from "preact/hooks";
import { effect, type Signal } from "@preact/signals-core";
import clsx from "clsx";
import {
  year as globalYear,
  categories as globalCategories,
} from "../lib/state.js";
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
  class: className,
}: {
  year?: Signal<number>;
  categories?: Signal<string[]>;
  class?: string;
}) {
  const host = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const map = createGenevaMap();
    host.current!.append(map.node);
    // cover, not contain — crops instead of letterboxing; d3-zoom pointer math stays correct via CTM inversion
    map.node.style.height = "100%"; // factory wrapper div must fill .map so the svg's 100% resolves
    map.svg
      .attr("preserveAspectRatio", "xMidYMid slice")
      .style("height", "100%");
    const dispose = effect(() =>
      map.setLayer(basemapForYear(year.value, { editions, layersData })),
    );
    const disposeMarkers = attachMarkers(map, { year, categories });
    return () => {
      dispose();
      disposeMarkers();
      map.node.remove();
    };
  }, [year, categories]);

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

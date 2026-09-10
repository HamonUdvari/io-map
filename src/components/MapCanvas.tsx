import { useEffect, useRef } from "preact/hooks";
import { effect, type Signal } from "@preact/signals-core";
import clsx from "clsx";
import { year as globalYear } from "../lib/state.js";
import { createGenevaMap, basemapForYear } from "../../docs/lib/geneva-map.js";
import editions from "../../docs/data/zeitreise-editions.json";
import layersData from "../../docs/data/swisstopo-layers.json";

// The single d3 seam: mounts the imperative map factory once and never lets Preact
// touch anything below map.node. State flows in through the `year` signal only —
// pass a local one (stories) or let it default to the site's global signal.
export default function MapCanvas({
  year = globalYear,
  class: className,
}: {
  year?: Signal<number>;
  class?: string;
}) {
  const host = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const map = createGenevaMap();
    host.current!.append(map.node);
    const dispose = effect(() =>
      map.setLayer(basemapForYear(year.value, { editions, layersData })),
    );
    return () => {
      dispose();
      map.node.remove();
    };
  }, [year]);

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

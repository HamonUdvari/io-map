// Organisation markers on the map: supercluster count circles zoomed out,
// individually spread dots zoomed in — the v3-overlapping-points notebook's
// zoom policy, wired to the site's year + category signals.
//
// ALL behaviour/geometry tuning lives in MARKER_PARAMS below. Colors,
// strokes, and hover states live in global.css (.marker, .marker-count) on
// the io- design tokens — between the two, every styling knob has one home.
import Supercluster from "supercluster";
import { effect } from "./state.js";
import { pointsIn, categoryKey } from "./orgs.js";
import {
  groupByCoordinate,
  stackOffsets,
  toFeatures,
} from "../../docs/lib/io-data.js";

// The notebook's parameters — adapt the marker behaviour here.
export const MARKER_PARAMS = {
  spreadAtZoom: 16, // below: clusters; at/above: every organisation its own dot
  clusterRadius: 40, // supercluster radius (512-unit tiles ≈ half that in px)
  jitterRadius: 10, // px spread cloud for organisations sharing one address
  dotRadius: 5, // px radius of a single organisation dot
  clusterRadiusFor: (count) => Math.min(28, 8 + 4 * Math.sqrt(count)),
  bboxPad: 0.2, // cluster query overscan, so markers slide in instead of popping
};

const markerClass = (key) => `marker marker-${key ?? "neutral"}`;

// single-category clusters keep the category color; mixed ones go neutral
const clusterClass = (p) => {
  const present = ["pr", "io", "ngo"].filter((k) => p[k] > 0);
  return markerClass(present.length === 1 ? present[0] : "cluster");
};

// Subscribes the marker overlay to the signals; returns the dispose function.
// Rebuilds the cluster index when year/categories change — the overlay then
// redraws from it on every camera move.
export function attachMarkers(map, { year, categories }) {
  return effect(() => {
    const cats = categories.value;
    const points = pointsIn(year.value).filter(
      (d) => cats.length === 0 || cats.includes(categoryKey(d)),
    );

    // same-address stacks spread apart with deterministic jitter (spread mode)
    const spread = [];
    for (const members of groupByCoordinate(points).values()) {
      const offsets = stackOffsets(members.length, MARKER_PARAMS.jitterRadius);
      members.forEach((d, i) => spread.push({ d, off: offsets[i] }));
    }

    // per-category counts ride up into the clusters for the color rule
    const index = new Supercluster({
      radius: MARKER_PARAMS.clusterRadius,
      maxZoom: 19,
      minPoints: 2,
      map: (p) => {
        const k = categoryKey(p);
        return {
          pr: k === "pr" ? 1 : 0,
          io: k === "io" ? 1 : 0,
          ngo: k === "ngo" ? 1 : 0,
        };
      },
      reduce: (acc, p) => {
        acc.pr += p.pr;
        acc.io += p.io;
        acc.ngo += p.ngo;
      },
    }).load(toFeatures(points));

    map.setOverlay((g, helpers) => draw(g, helpers, { index, spread, map }));
  });
}

function draw(g, { zoomLevel, bbox, project }, { index, spread, map }) {
  const clustered = zoomLevel < MARKER_PARAMS.spreadAtZoom;
  const [w, s, e, n] = bbox;
  const pad = MARKER_PARAMS.bboxPad;
  const clusters = clustered
    ? index.getClusters(
        [
          w - (e - w) * pad,
          s - (n - s) * pad,
          e + (e - w) * pad,
          n + (n - s) * pad,
        ],
        Math.max(0, Math.floor(zoomLevel)),
      )
    : [];

  g.selectAll("g.cluster")
    .data(clusters, (c) =>
      c.properties.cluster
        ? `c${c.properties.cluster_id}`
        : `s${c.properties.nameEN}`,
    )
    .join((enter) => {
      const gc = enter.append("g").attr("class", "cluster");
      gc.append("circle");
      gc.append("text")
        .attr("class", "marker-count")
        .attr("text-anchor", "middle")
        .attr("dy", "0.35em");
      return gc;
    })
    .call((sel) => {
      sel
        .select("circle")
        .attr("class", (c) =>
          c.properties.cluster
            ? `${clusterClass(c.properties)} cursor-pointer`
            : markerClass(categoryKey(c.properties)),
        )
        .attr("r", (c) =>
          c.properties.cluster
            ? MARKER_PARAMS.clusterRadiusFor(c.properties.point_count)
            : MARKER_PARAMS.dotRadius,
        );
      sel
        .select("text")
        .text((c) => (c.properties.cluster ? c.properties.point_count : ""));
    })
    .attr("transform", (c) => `translate(${project(c.geometry.coordinates)})`)
    .on("click", (event, c) => {
      if (!c.properties.cluster) return;
      map.flyTo({
        center: c.geometry.coordinates,
        zoom: Math.min(
          index.getClusterExpansionZoom(c.properties.cluster_id),
          MARKER_PARAMS.spreadAtZoom,
        ),
      });
    });

  g.selectAll("circle.org")
    .data(clustered ? [] : spread, (o) => o.d.nameEN)
    .join("circle")
    .attr("class", (o) => `org ${markerClass(categoryKey(o.d))}`)
    .attr("r", MARKER_PARAMS.dotRadius)
    .attr("cx", (o) => project([o.d.long, o.d.lat])[0] + o.off[0])
    .attr("cy", (o) => project([o.d.long, o.d.lat])[1] + o.off[1]);
}

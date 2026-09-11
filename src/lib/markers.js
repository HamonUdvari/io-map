// Organisation markers on the map: supercluster count circles zoomed out,
// individually spread dots zoomed in — the v3-overlapping-points notebook's
// zoom policy, wired to the site's year + category signals.
//
// ALL behaviour/geometry tuning lives in MARKER_PARAMS below. Colors,
// strokes, and hover states live in global.css (.marker, .marker-count) on
// the io- design tokens — between the two, every styling knob has one home.
import Supercluster from "supercluster";
import { h, render } from "preact";
import { effect, selectEpoch } from "./state.js";
import { filteredPoints, categoryKey } from "./orgs.js";
import MarkerTip from "../components/MarkerTip";
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
  dotRadius: 5, // px radius of a single organisation dot (selection scales via CSS)
  selectDelay: 250, // ms: let the dot's scale-up play before the infobox opens
  clusterRadiusFor: (count) => Math.min(28, 8 + 4 * Math.sqrt(count)),
  bboxPad: 0.2, // cluster query overscan, so markers slide in instead of popping
  tipMaxRows: 8, // hover-tip member rows before "+ N more"
};

const markerClass = (key) => `marker marker-${key ?? "neutral"}`;

// Dot-click choreography: mark the circle selected NOW (the CSS scale
// transition plays) and land the selection in the state a beat later, so
// the pop is visible before the infobox takes over.
const selectWithPop = (event, name, selected) => {
  event.stopPropagation();
  // singleton clicks land on the g.cluster group — the styled .marker is
  // its circle; spread clicks land on the circle itself
  const el = event.currentTarget;
  const circle = el.tagName === "g" ? el.querySelector("circle") : el;
  circle.classList.add("marker-selected");
  setTimeout(() => {
    selected.value = name;
    selectEpoch.value++;
  }, MARKER_PARAMS.selectDelay);
};

// single-category clusters keep the category color; mixed ones go neutral
const clusterClass = (p) => {
  const present = ["pr", "io", "ngo"].filter((k) => p[k] > 0);
  return markerClass(present.length === 1 ? present[0] : "cluster");
};

// The hover tip: an HTML card over the map — d3 toggles and positions it,
// Preact renders MarkerTip (the standard Table rows) into it. Hover-only:
// touch pointers skip it (tap opens the infobox instead).
function createTip(map) {
  const el = document.createElement("div");
  el.className = "map-tip";
  el.hidden = true;
  map.node.appendChild(el);

  // clamp-and-flip positioning from client coordinates, ported from the
  // geneva-map factory's notebook tooltip
  const place = (event) => {
    const r = map.node.getBoundingClientRect();
    let x = event.clientX - r.left + 12;
    let y = event.clientY - r.top + 12;
    if (x + el.offsetWidth > r.width)
      x = Math.max(0, event.clientX - r.left - 12 - el.offsetWidth);
    if (y + el.offsetHeight > r.height)
      y = Math.max(0, event.clientY - r.top - 12 - el.offsetHeight);
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
  };

  return {
    show(event, props) {
      if (event.pointerType === "touch") return;
      render(h(MarkerTip, props), el);
      el.hidden = false;
      place(event);
    },
    move(event) {
      if (!el.hidden) place(event);
    },
    hide() {
      el.hidden = true;
    },
    dispose() {
      render(null, el);
      el.remove();
    },
  };
}

// svg has no z-index: re-appending makes the element paint last (on top).
// Guarded — the re-insert resets the browser's hover chain (pointerleave
// would never fire); once the element IS last, later pointerovers no-op and
// the chain stabilizes.
const raise = (event) => {
  const el = event.currentTarget;
  if (el.parentNode.lastElementChild !== el) el.parentNode.appendChild(el);
};

const tipRow = (d) => ({ name: d.nameEN, category: categoryKey(d) });
const tipAddress = (d) => d.addressInfoboxDisplay || d.addressOSM || null;

// hovered/leading org first, member cap, overflow count. A lone org is just
// a one-row table — the address line only earns its place when it is the
// SHARED address of several members.
function tipProps(members, address) {
  const items = members.slice(0, MARKER_PARAMS.tipMaxRows).map(tipRow);
  return {
    items,
    address: members.length > 1 ? address : null,
    more: Math.max(0, members.length - items.length),
  };
}

// Subscribes the marker overlay to the signals; returns the dispose function.
// Rebuilds the cluster index when year/categories change — the overlay then
// redraws from it on every camera move.
export function attachMarkers(map, { year, categories, query, selected }) {
  // clicking the map anywhere but a dot dismisses the selection (dot clicks
  // stop propagation); cluster clicks fly AND clear — they navigate away
  map.svg.on("click.select", () => (selected.value = null));
  const tip = createTip(map);
  // safety net for the raise-on-hover chain resets: any hover that lands on
  // bare map (not a marker) dismisses the tip
  map.svg.on("pointerover.tip", (event) => {
    if (!event.target.closest("g.cluster, circle.org")) tip.hide();
  });
  const dispose = effect(() => {
    const sel = selected.value;
    tip.hide(); // the hovered marker may not survive the data change
    const points = filteredPoints(year.value, categories.value, query.value);

    // same-address stacks spread apart with deterministic jitter (spread
    // mode); members ride along for the hover tip's shared-address list
    const spread = [];
    for (const members of groupByCoordinate(points).values()) {
      const offsets = stackOffsets(members.length, MARKER_PARAMS.jitterRadius);
      members.forEach((d, i) => spread.push({ d, members, off: offsets[i] }));
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

    map.setOverlay((g, helpers) =>
      draw(g, helpers, { index, spread, map, sel, selected, tip }),
    );
  });
  return () => {
    dispose();
    tip.dispose();
    map.setOverlay(() => {});
    map.svg.on("click.select", null);
    map.svg.on("pointerover.tip", null);
  };
}

function draw(
  g,
  { zoomLevel, bbox, project },
  { index, spread, map, sel, selected, tip },
) {
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
    .call((groups) => {
      groups
        .select("circle")
        .attr("class", (c) =>
          c.properties.cluster
            ? `${clusterClass(c.properties)} cursor-pointer`
            : `${markerClass(categoryKey(c.properties))} cursor-pointer ${
                c.properties.nameEN === sel ? "marker-selected" : ""
              }`,
        )
        .attr("r", (c) =>
          c.properties.cluster
            ? MARKER_PARAMS.clusterRadiusFor(c.properties.point_count)
            : MARKER_PARAMS.dotRadius,
        );
      groups
        .select("text")
        .text((c) => (c.properties.cluster ? c.properties.point_count : ""));
    })
    .attr("transform", (c) => `translate(${project(c.geometry.coordinates)})`)
    .on("pointerover", (event, c) => {
      raise(event); // svg paints in document order — hovered marker on top
      const p = c.properties;
      const members = p.cluster
        ? index.getLeaves(p.cluster_id, Infinity).map((l) => l.properties)
        : [p];
      tip.show(event, tipProps(members, p.cluster ? null : tipAddress(p)));
    })
    .on("pointermove", (event) => tip.move(event))
    .on("pointerleave", () => tip.hide())
    .on("click", (event, c) => {
      tip.hide();
      if (!c.properties.cluster) {
        // a zoomed-out singleton is one organisation — select it
        selectWithPop(event, c.properties.nameEN, selected);
        return;
      }
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
    .attr(
      "class",
      (o) =>
        `org ${markerClass(categoryKey(o.d))} cursor-pointer ${
          o.d.nameEN === sel ? "marker-selected" : ""
        }`,
    )
    .attr("r", MARKER_PARAMS.dotRadius)
    .attr("cx", (o) => project([o.d.long, o.d.lat])[0] + o.off[0])
    .attr("cy", (o) => project([o.d.long, o.d.lat])[1] + o.off[1])
    .on("pointerover", (event, o) => {
      raise(event); // svg paints in document order — hovered marker on top
      // the hovered org leads, its same-address companions follow
      const members = [o.d, ...o.members.filter((m) => m !== o.d)];
      tip.show(event, tipProps(members, tipAddress(o.d)));
    })
    .on("pointermove", (event) => tip.move(event))
    .on("pointerleave", () => tip.hide())
    .on("click", (event, o) => {
      tip.hide();
      selectWithPop(event, o.d.nameEN, selected);
    });
}

// Organisation markers on the map: supercluster count circles zoomed out,
// individually spread dots zoomed in — the v3-overlapping-points notebook's
// zoom policy, wired to the site's year + category signals.
//
// ALL behaviour/geometry tuning lives in MARKER_PARAMS below. Colors,
// strokes, and hover states live in global.css (.marker, .marker-count) on
// the io- design tokens — between the two, every styling knob has one home.
import Supercluster from "supercluster";
import { h, render } from "preact";
import { effect } from "./state.js";
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
  // touch taps on bare map activate the nearest marker whose EDGE is within
  // this many px — a 10px dot alone is far below the 44px target that Apple
  // HIG / WCAG 2.5.5 recommend (WCAG 2.5.8 AA minimum: 24px); mouse stays
  // precise
  touchRadius: 22,
  clusterFlyMs: 750, // cluster-tap fly-in (half the factory's 1500 — 2x speed)
  longPressMs: 450, // touch: hold this long on a marker to peek at its tip
};

const markerClass = (key) => `marker marker-${key ?? "neutral"}`;

// Marker activation is detected manually on pointerup (pressed element +
// minimal travel, mirroring the zoom's clickDistance): Chrome does NOT
// synthesize a click on an element that the hover raise re-appended, so a
// click handler would never fire on first hover. Touch gets a looser travel
// tolerance — finger jitter exceeds a mouse's.
const TAP_DIST = 4;
const TOUCH_TAP_DIST = 10;
const tapDist = (event) =>
  event.pointerType === "touch" ? TOUCH_TAP_DIST : TAP_DIST;
// module-scoped: only one pointer can be mid-tap at a time (a second
// concurrent pointer voids the slot — a pinch is not a tap). Shared across
// map instances; the element + pointerId checks prevent cross-talk.
let tapStart = null;
const tapDown = (event) => {
  if (event.button !== 0) return; // primary only (touch reports 0)
  tapStart =
    tapStart == null
      ? {
          el: event.currentTarget,
          id: event.pointerId,
          x: event.clientX,
          y: event.clientY,
        }
      : null;
};
const cancelTap = () => (tapStart = null);
const isTap = (event) => {
  const t = tapStart;
  tapStart = null;
  return (
    t != null &&
    t.id === event.pointerId &&
    t.el === event.currentTarget &&
    Math.hypot(event.clientX - t.x, event.clientY - t.y) <= tapDist(event)
  );
};

// Dot-tap choreography: mark the circle selected NOW (the CSS scale
// transition plays) and land the selection in the state a beat later, so
// the pop is visible before the infobox takes over.
const selectWithPop = (el, name, selected) => {
  // singleton taps land on the g.cluster group — the styled .marker is
  // its circle; spread taps land on the circle itself
  const circle = el.tagName === "g" ? el.querySelector("circle") : el;
  circle.classList.add("marker-selected");
  setTimeout(() => {
    selected.value = name;
  }, MARKER_PARAMS.selectDelay);
};

// One activation path for every tap flavor (direct or touch-assisted): the
// element's d3 datum tells cluster (fly) from singleton/spread dot (select).
const activate = (el, { map, index, selected, tip }) => {
  const datum = el.__data__;
  tip.hide();
  if (datum?.properties != null) {
    if (!datum.properties.cluster) {
      selectWithPop(el, datum.properties.nameEN, selected);
      return;
    }
    map.flyTo(
      {
        center: datum.geometry.coordinates,
        zoom: Math.min(
          index.getClusterExpansionZoom(datum.properties.cluster_id),
          MARKER_PARAMS.spreadAtZoom,
        ),
      },
      { duration: MARKER_PARAMS.clusterFlyMs },
    );
  } else if (datum?.d != null) {
    selectWithPop(el, datum.d.nameEN, selected);
  }
};

// Nearest marker whose visual edge is within `radius` px of the tap point.
const nearestMarker = (svgNode, event, radius) => {
  let best = null;
  let bestDist = radius;
  for (const el of svgNode.querySelectorAll("g.cluster, circle.org")) {
    const r = el.getBoundingClientRect();
    const dist =
      Math.hypot(
        event.clientX - (r.x + r.width / 2),
        event.clientY - (r.y + r.height / 2),
      ) -
      Math.max(r.width, r.height) / 2;
    if (dist < bestDist) {
      bestDist = dist;
      best = el;
    }
  }
  return best;
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
    show(event, props, force = false) {
      if (!force && event.pointerType === "touch") return;
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

// tip content for any marker element, from its d3 datum (cluster feature or
// spread entry) — shared by mouse hover and the touch long-press peek
const tipPropsFor = (el, index) => {
  const datum = el.__data__;
  if (datum?.properties != null) {
    const p = datum.properties;
    const members = p.cluster
      ? index.getLeaves(p.cluster_id, Infinity).map((l) => l.properties)
      : [p];
    return tipProps(members, p.cluster ? null : tipAddress(p));
  }
  if (datum?.d != null) {
    const members = [datum.d, ...datum.members.filter((m) => m !== datum.d)];
    return tipProps(members, tipAddress(datum.d));
  }
  return null;
};

// Touch long-press: hold on (or just off) a marker to peek at its tip —
// hover's stand-in. Firing consumes the gesture (the release must not
// select) and the release hides the tip. One press at a time, pointerId-
// checked so an unrelated pointer's events cannot clear or consume it.
let longPress = null; // { id, timer, x, y, fired }
const clearLongPress = () => {
  if (longPress != null) clearTimeout(longPress.timer);
  longPress = null;
};
const armLongPress = (event, ctx, el = event.currentTarget) => {
  clearLongPress(); // also flushes stale state before the type check
  if (event.pointerType !== "touch") return;
  const { clientX, clientY } = event;
  const state = {
    id: event.pointerId,
    x: clientX,
    y: clientY,
    fired: false,
    timer: 0,
  };
  state.timer = setTimeout(() => {
    // the marker join may have removed the element mid-hold (year scrub on
    // a second pointer) — a tip for it could never be dismissed by hover
    if (!el.isConnected) {
      clearLongPress();
      return;
    }
    state.fired = true;
    const props = tipPropsFor(el, ctx.index);
    if (props != null)
      ctx.tip.show({ pointerType: "touch", clientX, clientY }, props, true);
  }, MARKER_PARAMS.longPressMs);
  longPress = state;
};
// shared release handling: true when this pointer's long-press consumed the
// gesture (peek shown — hide it, spend the tap slot, activate nothing)
const consumeLongPress = (event, tip) => {
  if (longPress == null || longPress.id !== event.pointerId) return false;
  const { fired } = longPress;
  clearLongPress();
  if (!fired) return false;
  tip.hide();
  if (tapStart?.id === event.pointerId) cancelTap();
  return true;
};
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
  let currentCtx = null; // the live effect's draw context, for the assist path
  let assistedAt = 0; // an assisted tap's synthesized click must not clear

  // clicking the map anywhere but a marker dismisses the selection (marker
  // taps run on pointerup and usually produce no synthesized click at all —
  // see the raise note above — so clicks landing on markers are ignored;
  // cluster taps fly WITHOUT clearing: the containing-cluster ring keeps a
  // retained selection coherent at clustered zooms)
  map.svg.on("click.select", (event) => {
    if (performance.now() - assistedAt < 500) {
      assistedAt = 0; // one-shot: only the assisted tap's own click
      return;
    }
    if (event.target.closest("g.cluster, circle.org")) return;
    selected.value = null;
  });

  // touch tap assist: a touch tap on bare map activates the nearest marker
  // within MARKER_PARAMS.touchRadius (see the param note on HIG/WCAG sizes).
  // One slot, pointerId-checked: a second concurrent touch voids it (pinch).
  let assistStart = null;
  map.svg.on("pointerdown.assist", (event) => {
    if (event.pointerType !== "touch") return;
    assistStart =
      assistStart == null
        ? { id: event.pointerId, x: event.clientX, y: event.clientY }
        : null;
    // near-miss long-press: holding just OFF a dot (inside the assist
    // radius) peeks the same tip a hold ON it would — direct hits already
    // armed in the marker's own pointerdown before this bubbled here
    if (currentCtx != null && !event.target.closest("g.cluster, circle.org")) {
      const el = nearestMarker(
        map.svg.node(),
        event,
        MARKER_PARAMS.touchRadius,
      );
      if (el != null) armLongPress(event, currentCtx, el);
    }
  });
  // finger travel past the tap tolerance cancels a pending press — one
  // svg-level check covers marker and near-miss presses alike (bubbling)
  map.svg.on("pointermove.assist", (event) => {
    if (
      longPress != null &&
      longPress.id === event.pointerId &&
      !longPress.fired &&
      Math.hypot(event.clientX - longPress.x, event.clientY - longPress.y) >
        TOUCH_TAP_DIST
    )
      clearLongPress();
  });
  map.svg.on("pointercancel.assist", () => {
    assistStart = null;
    cancelTap();
    clearLongPress();
    tip.hide(); // a fired peek would otherwise strand on screen
  });
  map.svg.on("pointerup.assist", (event) => {
    // a fired peek consumes the release even when the pressed marker left
    // the DOM mid-hold (the release then lands on bare svg and would
    // otherwise fall through to the assist activation below)
    if (consumeLongPress(event, tip)) {
      assistStart = null;
      return;
    }
    const start = assistStart;
    assistStart = null;
    if (event.pointerType !== "touch" || start == null) return;
    if (start.id !== event.pointerId) return;
    if (
      Math.hypot(event.clientX - start.x, event.clientY - start.y) >
      TOUCH_TAP_DIST
    )
      return;
    if (event.target.closest("g.cluster, circle.org")) return; // direct hit
    if (currentCtx == null) return;
    const el = nearestMarker(map.svg.node(), event, MARKER_PARAMS.touchRadius);
    if (el == null) return;
    assistedAt = performance.now();
    activate(el, currentCtx);
  });

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

    // one context object per effect run: draw() runs per camera frame and
    // caches the selected org's containing cluster per integer zoom in it
    const ctx = {
      index,
      spread,
      map,
      sel,
      selected,
      tip,
      selClusterByZ: new Map(),
    };
    currentCtx = ctx;
    map.setOverlay((g, helpers) => draw(g, helpers, ctx));
  });
  return () => {
    dispose();
    clearLongPress();
    tip.dispose();
    map.setOverlay(() => {});
    map.svg.on("click.select", null);
    map.svg.on("pointerover.tip", null);
    map.svg.on("pointerdown.assist", null);
    map.svg.on("pointerup.assist", null);
    map.svg.on("pointercancel.assist", null);
  };
}

// The cluster (if any) holding the selected org at this integer zoom — it
// inherits the selected treatment while the org itself is invisible inside.
function selClusterId(ctx, z) {
  const { index, sel, selClusterByZ } = ctx;
  if (!selClusterByZ.has(z)) {
    let found = null;
    for (const c of index.getClusters([-180, -85, 180, 85], z)) {
      if (!c.properties.cluster) continue; // singletons ring themselves
      if (
        index
          .getLeaves(c.properties.cluster_id, Infinity)
          .some((l) => l.properties.nameEN === sel)
      ) {
        found = c.properties.cluster_id;
        break;
      }
    }
    selClusterByZ.set(z, found);
  }
  return selClusterByZ.get(z);
}

function draw(g, { zoomLevel, bbox, project }, ctx) {
  const { index, spread, map, sel, selected, tip } = ctx;
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
      const ringed =
        sel != null && clustered
          ? selClusterId(ctx, Math.max(0, Math.floor(zoomLevel)))
          : null;
      groups
        .select("circle")
        .attr("class", (c) =>
          c.properties.cluster
            ? `${clusterClass(c.properties)} cursor-pointer ${
                c.properties.cluster_id === ringed ? "marker-selected" : ""
              }`
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
    .on("pointerover", (event) => {
      raise(event); // svg paints in document order — hovered marker on top
      tip.show(event, tipPropsFor(event.currentTarget, index));
    })
    .on("pointermove", (event) => tip.move(event))
    .on("pointerleave", () => tip.hide())
    .on("pointerdown", (event) => {
      tapDown(event);
      armLongPress(event, ctx);
    })
    .on("pointerup", (event) => {
      if (consumeLongPress(event, tip)) return;
      if (!isTap(event)) return;
      activate(event.currentTarget, ctx);
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
    .on("pointerover", (event) => {
      raise(event); // svg paints in document order — hovered marker on top
      tip.show(event, tipPropsFor(event.currentTarget, index));
    })
    .on("pointermove", (event) => tip.move(event))
    .on("pointerleave", () => tip.hide())
    .on("pointerdown", (event) => {
      tapDown(event);
      armLongPress(event, ctx);
    })
    .on("pointerup", (event) => {
      if (consumeLongPress(event, tip)) return;
      if (!isTap(event)) return;
      activate(event.currentTarget, ctx);
    });
}

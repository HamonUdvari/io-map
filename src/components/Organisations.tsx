import { useEffect, useRef } from "preact/hooks";
import { useSignal } from "@preact/signals";
import clsx from "clsx";
import {
  year,
  categories,
  query,
  mapBbox,
  selectedOrg,
  centerOn,
} from "../lib/state.js";
import {
  pointsIn,
  organisationsIn,
  categoryKey,
  nameMatches,
} from "../lib/orgs.js";
import {
  orgInfo,
  eventGroups,
  nearestTo,
  demoContent,
} from "../lib/org-info.js";
import Drawer, { type DrawerState } from "./Drawer";
import InfoBox from "./InfoBox";
import Table from "./Table";
import TextFilter from "./TextFilter";

// static strings — Tailwind's scanner cannot see composed class names
const TINTS: Record<string, string> = {
  pr: "drawer-tinted-pr",
  ngo: "drawer-tinted-ngo",
  io: "drawer-tinted-io",
};

// Island: the organisations drawer. Two modes on one Drawer:
// - no selection: name filter + the table of the organisations the map
//   shows (year + category + name filters + current viewport), sorted A–Z
// - an organisation selected (marker click): the category-tinted InfoBox;
//   clicking the map background clears the selection and restores the table
// `class` reaches the Drawer root — the page passes its grid placement.
export default function Organisations({
  class: className,
}: {
  class?: string;
}) {
  const drawer = useSignal<DrawerState>("half");
  const selected = selectedOrg.value;
  const points = pointsIn(year.value);

  // the selection SURVIVES years where the org doesn't exist (closed/moved
  // gaps): the infobox stays with an absent note, so scrubbing across a gap
  // keeps tracking the organisation. Absence = ACTIVITY (closed/moved/not
  // yet founded), not geocoding — a few active orgs have unmapped addresses
  // and must not be declared "not present".
  const active =
    selected != null && organisationsIn(year.value).includes(selected);

  // follow the selected organisation through time: scrubbing the year pans
  // the map to its address of that year whenever it moved, so relocations
  // can be tracked. Selecting only records the position (marker clicks must
  // not pan; table clicks center via selectRow).
  const selPoint =
    selected != null
      ? (points.find((d: any) => d.nameEN === selected) ?? null)
      : null;
  const lastPos = useRef<{ name: string; lat: number; long: number } | null>(
    null,
  );
  useEffect(() => {
    if (selected == null) {
      lastPos.current = null;
      return;
    }
    // absent year: keep the trail so scrubbing across a gap pans to the
    // reappearance address
    if (selPoint == null) return;
    const prev = lastPos.current;
    if (
      prev != null &&
      prev.name === selPoint.nameEN &&
      (prev.lat !== selPoint.lat || prev.long !== selPoint.long)
    ) {
      centerOn([selPoint.long, selPoint.lat]);
    }
    lastPos.current = {
      name: selPoint.nameEN,
      lat: selPoint.lat,
      long: selPoint.long,
    };
  }, [selected, selPoint?.nameEN, selPoint?.lat, selPoint?.long]);

  // selection does NOT move the sheet: it keeps its current detent and only
  // the content swaps (mobile wish — no sliding); desktop is always open
  const info = selected != null ? orgInfo(selected, year.value) : null;

  // row click (main table and the infobox's nearest list): select the org
  // and pan the map to it at the current zoom
  const selectRow = (row: { name: string }) => {
    selectedOrg.value = row.name;
    const point = points.find((d: any) => d.nameEN === row.name);
    if (point) centerOn([point.long, point.lat]);
  };

  if (info != null) {
    const demo = demoContent(info.name); // TODO remove: Afghanistan-only mock
    return (
      <Drawer
        state={drawer.value}
        onStateChange={(next) => (drawer.value = next)}
        onClose={() => (selectedOrg.value = null)}
        class={clsx(className, info.key != null && TINTS[info.key])}
        header={
          <h2 class="drawer-title">
            {info.prefix != null && `[${info.prefix}] `}
            {info.name}
          </h2>
        }
      >
        <InfoBox
          info={info}
          groups={eventGroups(info.history)}
          nearest={nearestTo(info.name, year.value, {
            cats: categories.value,
            query: query.value,
          })}
          absentYear={active ? null : year.value}
          onSelectNearest={selectRow}
          onJump={() => (drawer.value = "open")}
          about={demo?.about}
          photo={demo?.photo}
          url={demo?.url}
        />
      </Drawer>
    );
  }

  const cats = categories.value;
  const bbox = mapBbox.value;
  const visible = points
    .filter((d: any) => cats.length === 0 || cats.includes(categoryKey(d)))
    .filter((d: any) => nameMatches(d, query.value))
    .filter(
      (d: any) =>
        bbox === null ||
        (d.long >= bbox[0] &&
          d.lat >= bbox[1] &&
          d.long <= bbox[2] &&
          d.lat <= bbox[3]),
    )
    .sort((a: any, b: any) => a.nameEN.localeCompare(b.nameEN));

  return (
    <Drawer
      state={drawer.value}
      onStateChange={(next) => (drawer.value = next)}
      class={className}
      header={
        <span>
          Organisations ({visible.length}/{organisationsIn(year.value).length})
        </span>
      }
    >
      <div class="org-filter">
        <TextFilter
          value={query.value}
          onInput={(next) => (query.value = next)}
        />
      </div>
      <Table
        items={visible.map((d: any) => ({
          name: d.nameEN,
          category: categoryKey(d),
        }))}
        onSelect={selectRow}
      />
    </Drawer>
  );
}

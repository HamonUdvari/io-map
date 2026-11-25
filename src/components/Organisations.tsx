import { useEffect, useRef } from "preact/hooks";
import { useSignal } from "@preact/signals";
import clsx from "clsx";
import {
  year,
  categories,
  query,
  mapBbox,
  selectedOrg,
  hoveredOrg,
  centerOn,
  pinnedOrgs,
  togglePin,
  clearPins,
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
//   shows (year + category + name filters + current viewport), sorted A–Z.
//   With pinned organisations the table lists THOSE instead (the map shows
//   only them); typing in the name filter then searches every organisation
//   of the year, to pin more
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
      ? (points.find((d: any) => d.uniqueName === selected) ?? null)
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
      prev.name === selPoint.uniqueName &&
      (prev.lat !== selPoint.lat || prev.long !== selPoint.long)
    ) {
      centerOn([selPoint.long, selPoint.lat]);
    }
    lastPos.current = {
      name: selPoint.uniqueName,
      lat: selPoint.lat,
      long: selPoint.long,
    };
  }, [selected, selPoint?.uniqueName, selPoint?.lat, selPoint?.long]);

  // selection does NOT move the sheet: it keeps its current detent and only
  // the content swaps (mobile wish — no sliding); desktop is always open
  const info = selected != null ? orgInfo(selected, year.value) : null;

  // row hover (both tables): echo the row's marker on the map
  const hoverRow = (row: { id?: string; name: string } | null) =>
    (hoveredOrg.value = row?.id ?? row?.name ?? null);

  // row click (main table and the infobox's nearest list): select the org
  // and pan the map to it at the current zoom
  const selectRow = (row: { id?: string; name: string }) => {
    const id = row.id ?? row.name;
    hoveredOrg.value = null; // the list is about to unmount — no stale echo
    selectedOrg.value = id;
    const point = points.find((d: any) => d.uniqueName === id);
    if (point) centerOn([point.long, point.lat]);
  };

  if (info != null) {
    const demo = demoContent(info.id); // TODO remove: Afghanistan-only mock
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
          nearest={nearestTo(info.id, year.value, {
            cats: categories.value,
            query: query.value,
          })}
          absentYear={active ? null : year.value}
          onSelectNearest={selectRow}
          onHoverNearest={hoverRow}
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
  const pins: string[] = pinnedOrgs.value;
  const pinning = pins.length > 0;
  const searching = query.value.trim() !== "";
  const visible = (
    pinning
      ? // pin mode: the pinned organisations, wherever they are on the map;
        // a name query widens the list to every match, so more can be pinned
        points.filter((d: any) =>
          searching ? nameMatches(d, query.value) : pins.includes(d.uniqueName),
        )
      : points
          .filter(
            (d: any) => cats.length === 0 || cats.includes(categoryKey(d)),
          )
          .filter((d: any) => nameMatches(d, query.value))
          .filter(
            (d: any) =>
              bbox === null ||
              (d.long >= bbox[0] &&
                d.lat >= bbox[1] &&
                d.long <= bbox[2] &&
                d.lat <= bbox[3]),
          )
  ).sort((a: any, b: any) => a.nameEN.localeCompare(b.nameEN));
  // pinned organisations without a map point this year (not present, or no
  // known address) stay in the list, so a pin does not vanish while the
  // year moves
  const absentPins =
    pinning && !searching
      ? pins.filter((id) => !points.some((d: any) => d.uniqueName === id))
      : [];

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
      {pinning && (
        // TODO(design): interim pin bar
        <p class="pin-bar">
          <span>
            {pins.length} pinned — the map shows only{" "}
            {pins.length === 1 ? "this organisation" : "these organisations"}
          </span>
          <button type="button" onClick={clearPins}>
            Clear
          </button>
        </p>
      )}
      <Table
        items={[
          ...visible.map((d: any) => ({
            id: d.uniqueName,
            name: d.nameEN,
            category: categoryKey(d),
            pinned: pins.includes(d.uniqueName),
          })),
          ...absentPins.map((id) => ({
            id,
            name: id,
            pinned: true,
            right: `not on the map in ${year.value}`,
          })),
        ]}
        onSelect={selectRow}
        onHover={hoverRow}
        onTogglePin={(row) => togglePin(row.id ?? row.name)}
      />
    </Drawer>
  );
}

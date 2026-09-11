import { useEffect } from "preact/hooks";
import { useSignal } from "@preact/signals";
import clsx from "clsx";
import {
  year,
  categories,
  query,
  mapBbox,
  selectedOrg,
  selectEpoch,
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
export default function Organisations() {
  const drawer = useSignal<DrawerState>("half");
  const selected = selectedOrg.value;
  const points = pointsIn(year.value);

  // a selection scrubbed out of existence (year change) clears itself
  const present =
    selected != null && points.some((d: any) => d.nameEN === selected);
  useEffect(() => {
    if (selected != null && !present) selectedOrg.value = null;
  }, [selected, present]);

  // selection opens the sheet; deselection returns to the resting detent.
  // The epoch dep re-opens it when the SAME dot is clicked again (a
  // same-value selectedOrg write alone would not re-run this effect).
  const epoch = selectEpoch.value;
  useEffect(() => {
    drawer.value = selected != null && present ? "open" : "half";
  }, [selected, present, epoch]);

  const info = present ? orgInfo(selected!, year.value) : null;

  if (info != null) {
    const demo = demoContent(info.name); // TODO remove: Afghanistan-only mock
    return (
      <Drawer
        state={drawer.value}
        onStateChange={(next) => (drawer.value = next)}
        onClose={() => (selectedOrg.value = null)}
        class={clsx(info.key != null && TINTS[info.key])}
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
          nearest={nearestTo(info.name, year.value)}
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
      />
    </Drawer>
  );
}

import { year, categories, mapBbox } from "../lib/state.js";
import { pointsIn, organisationsIn, categoryKey } from "../lib/orgs.js";
import Drawer from "./Drawer";
import Table from "./Table";

// Island: the organisations drawer showing the same organisations the map
// does — year + category filters + the current viewport — sorted A–Z.
export default function Organisations() {
  const cats = categories.value;
  const bbox = mapBbox.value;
  const visible = pointsIn(year.value)
    .filter((d: any) => cats.length === 0 || cats.includes(categoryKey(d)))
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
      header={
        <span>
          Organisations ({visible.length}/{organisationsIn(year.value).length})
        </span>
      }
    >
      <Table
        items={visible.map((d: any) => ({
          name: d.nameEN,
          category: categoryKey(d),
        }))}
      />
    </Drawer>
  );
}

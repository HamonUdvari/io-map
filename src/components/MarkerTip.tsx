import Table, { type TableRow } from "./Table";

// Hover card content for map markers (Figma "Table - Popover" as a floating
// card): the member organisations as the standard striped table — one row
// for a lone dot, the member list for clusters and shared addresses — plus
// optional address and overflow lines. d3 owns the tip's position and
// lifecycle (markers.js); this component only renders the content.
export default function MarkerTip({
  items,
  address,
  more = 0,
}: {
  items: TableRow[];
  /** the shared address, shown under the rows (lone dots and stacks) */
  address?: string | null;
  /** members beyond the row cap: "+ N more" */
  more?: number;
}) {
  return (
    <>
      <Table items={items} />
      {address != null && <p class="map-tip-address">{address}</p>}
      {more > 0 && <p class="map-tip-more">+ {more} more</p>}
    </>
  );
}

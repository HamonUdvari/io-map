import clsx from "clsx";
import TableItem, { type TableRow } from "./TableItem";

export type { TableRow };

// Pure presentational: the striped organisations table (Figma "Table -
// Popover" body). Receives the already-filtered rows.
export default function Table({
  items,
  class: className,
}: {
  items: TableRow[];
  class?: string;
}) {
  return (
    // preflight strips list-style, which drops list semantics in VoiceOver
    <ul class={clsx("table-list", className)} role="list">
      {items.map((item) => (
        <TableItem key={item.name} {...item} />
      ))}
    </ul>
  );
}

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
    <ul class={clsx("table-list", className)}>
      {items.map((item) => (
        <TableItem key={item.name} {...item} />
      ))}
    </ul>
  );
}

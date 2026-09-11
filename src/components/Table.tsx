import clsx from "clsx";
import TableItem, { type TableRow } from "./TableItem";

export type { TableRow };

// Pure presentational: the striped organisations table (Figma "Table -
// Popover" body). Receives the already-filtered rows; with onSelect the
// rows become clickable, with onHover they report the row under the
// pointer (null once it leaves the list).
export default function Table({
  items,
  onSelect,
  onHover,
  class: className,
}: {
  items: TableRow[];
  onSelect?: (item: TableRow) => void;
  onHover?: (item: TableRow | null) => void;
  class?: string;
}) {
  return (
    // preflight strips list-style, which drops list semantics in VoiceOver
    <ul
      class={clsx("table-list", className)}
      role="list"
      onPointerLeave={onHover != null ? () => onHover(null) : undefined}
    >
      {items.map((item) => (
        <TableItem
          key={item.name}
          {...item}
          onClick={onSelect != null ? () => onSelect(item) : undefined}
          onPointerEnter={onHover != null ? () => onHover(item) : undefined}
        />
      ))}
    </ul>
  );
}

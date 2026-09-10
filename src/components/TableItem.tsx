import type { ComponentChildren } from "preact";
import clsx from "clsx";

export type TableRow = {
  name: string;
  /** pr | ngo | io; null/undefined = categoryless (dark dot) */
  category?: string | null;
  /** optional right-side info (distance, relation, …) */
  right?: ComponentChildren;
};

// One striped table row (Figma "table-item"): category dot, wrapping name,
// optional right-aligned info.
export default function TableItem({
  name,
  category,
  right,
  class: className,
}: TableRow & { class?: string }) {
  return (
    <li class={clsx("table-item", className)}>
      <span
        class="table-item-dot"
        data-category={category ?? undefined}
        aria-hidden="true"
      ></span>
      <span class="table-item-name">{name}</span>
      {right != null && <span class="table-item-right">{right}</span>}
    </li>
  );
}

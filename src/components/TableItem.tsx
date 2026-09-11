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
// optional right-aligned info. With onClick the row turns interactive
// (keyboard-operable button semantics).
export default function TableItem({
  name,
  category,
  right,
  onClick,
  onPointerEnter,
  class: className,
}: TableRow & {
  onClick?: () => void;
  onPointerEnter?: () => void;
  class?: string;
}) {
  return (
    <li
      class={clsx("table-item", className)}
      onClick={onClick}
      onPointerEnter={onPointerEnter}
      {...(onClick != null && {
        role: "button",
        tabIndex: 0,
        onKeyDown: (e: KeyboardEvent) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onClick();
          }
        },
      })}
    >
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

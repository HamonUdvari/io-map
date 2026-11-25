import type { ComponentChildren } from "preact";
import clsx from "clsx";

export type TableRow = {
  /** stable identifier (uniqueName); rows without one are identified by name */
  id?: string;
  /** display name (the organisation's name in the viewed year) */
  name: string;
  /** pr | ngo | io; null/undefined = categoryless (dark dot) */
  category?: string | null;
  /** optional right-side info (distance, relation, …) */
  right?: ComponentChildren;
  /** pinned for comparison (shown only when the table offers pinning) */
  pinned?: boolean;
};

// One striped table row (Figma "table-item"): category dot, wrapping name,
// optional right-aligned info. With onClick the row turns interactive
// (keyboard-operable button semantics). With onTogglePin the row gets a pin
// toggle; the row's own button role then moves to an inner element, because
// a button cannot contain another button.
export default function TableItem({
  name,
  category,
  right,
  pinned = false,
  onClick,
  onPointerEnter,
  onTogglePin,
  class: className,
}: TableRow & {
  onClick?: () => void;
  onPointerEnter?: () => void;
  onTogglePin?: () => void;
  class?: string;
}) {
  const button = onClick != null && {
    role: "button" as const,
    tabIndex: 0,
    onClick,
    onKeyDown: (e: KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        onClick();
      }
    },
  };
  const cells = (
    <>
      <span
        class="table-item-dot"
        data-category={category ?? undefined}
        aria-hidden="true"
      ></span>
      <span class="table-item-name">{name}</span>
      {right != null && <span class="table-item-right">{right}</span>}
    </>
  );

  if (onTogglePin != null) {
    return (
      <li class={clsx("table-item", className)} onPointerEnter={onPointerEnter}>
        <div class="table-item-main" {...button}>
          {cells}
        </div>
        {/* TODO(design): interim pin toggle */}
        <button
          type="button"
          class="table-item-pin"
          aria-pressed={pinned}
          aria-label={`${pinned ? "Unpin" : "Pin"} ${name}`}
          onClick={onTogglePin}
        >
          {pinned ? "Pinned" : "Pin"}
        </button>
      </li>
    );
  }

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

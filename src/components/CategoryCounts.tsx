import clsx from "clsx";

export type CategoryCount = {
  id: string;
  /** full category name, for screen readers */
  label: string;
  /** short visible label (PR, NGO, IO, …) */
  short: string;
  count: number;
};

// The organisations a list shows, split by category — the partners' wish:
// "Organisations: 85/400; PR: 30; NGO: 45; IO: 10". Pure presentational.
export default function CategoryCounts({
  counts,
  class: className,
}: {
  counts: CategoryCount[];
  class?: string;
}) {
  return (
    <ul class={clsx("category-counts", className)} role="list">
      {counts.map((c) => (
        <li key={c.id}>
          <span
            class="category-counts-dot"
            data-category={c.id}
            aria-hidden="true"
          ></span>
          <span aria-hidden="true">{c.short}</span>
          <span class="sr-only">{c.label}:</span> {c.count}
        </li>
      ))}
    </ul>
  );
}

import clsx from "clsx";

export type Category = { id: string; label: string };

// The three organisation categories (Figma "CategorySlider" labels).
export const CATEGORIES: Category[] = [
  { id: "pr", label: "Permanent Representation" },
  { id: "ngo", label: "Non Governmental Organization" },
  { id: "io", label: "International Organization" },
];

// Marker-type filter: native checkboxes (kept accessible via sr-only) inside
// pill labels — Space toggles, state is announced, no hand-written ARIA.
export default function CategoryFilter({
  selected,
  onToggle,
  categories = CATEGORIES,
  class: className,
}: {
  selected: string[];
  onToggle: (id: string) => void;
  categories?: Category[];
  class?: string;
}) {
  return (
    <fieldset class={clsx("category-filter", className)}>
      <legend class="sr-only">Filter by organisation category</legend>
      {categories.map((c) => (
        <label class="category-filter-item" key={c.id}>
          <input
            type="checkbox"
            class="sr-only"
            checked={selected.includes(c.id)}
            onChange={() => onToggle(c.id)}
          />
          <span
            class="category-filter-dot"
            data-category={c.id}
            aria-hidden="true"
          ></span>
          {c.label}
        </label>
      ))}
    </fieldset>
  );
}

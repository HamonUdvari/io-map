import { categories } from "../lib/state.js";
import CategoryFilter from "./CategoryFilter";

// Island binding the global selected-categories signal to CategoryFilter.
export default function CategoryFilters({
  class: className,
}: {
  class?: string;
}) {
  const toggle = (id: string) => {
    categories.value = categories.value.includes(id)
      ? categories.value.filter((c: string) => c !== id)
      : [...categories.value, id];
  };
  return (
    <CategoryFilter
      selected={categories.value}
      onToggle={toggle}
      class={className}
    />
  );
}

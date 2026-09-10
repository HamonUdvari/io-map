import clsx from "clsx";

// Name filter (Figma "Search" — but it filters, it doesn't search): pill
// field with a magnifier and a text input. Pure presentational: value in,
// event out. No signals, no state — the binding happens in the island/story
// that renders it, so it can live in the drawer, the nav, or anywhere else.
export default function TextFilter({
  value,
  onInput,
  placeholder = "Filtrer",
  class: className,
}: {
  value: string;
  onInput: (value: string) => void;
  placeholder?: string;
  class?: string;
}) {
  return (
    <label class={clsx("text-filter", className)}>
      <svg
        class="text-filter-icon"
        width="20"
        height="20"
        viewBox="0 0 20 20"
        fill="none"
        aria-hidden="true"
      >
        <circle
          cx="8.5"
          cy="8.5"
          r="5"
          stroke="currentColor"
          stroke-width="1.5"
        />
        <path d="M12.5 12.5L17 17" stroke="currentColor" stroke-width="1.5" />
      </svg>
      <input
        type="search"
        class="text-filter-input"
        value={value}
        placeholder={placeholder}
        aria-label={placeholder}
        onInput={(e) => onInput((e.target as HTMLInputElement).value)}
      />
    </label>
  );
}

import clsx from "clsx";

// Pure presentational: value in, event out. No signals, no state — the binding
// happens in the island/story that renders it.
export default function TextFilter({
  value,
  onInput,
  placeholder = "Filter…",
  class: className,
}: {
  value: string;
  onInput: (value: string) => void;
  placeholder?: string;
  class?: string;
}) {
  return (
    <input
      type="search"
      class={clsx("text-filter", className)}
      value={value}
      placeholder={placeholder}
      onInput={(e) => onInput((e.target as HTMLInputElement).value)}
    />
  );
}

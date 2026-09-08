// Pure presentational: value in, event out. No signals, no state — the binding
// happens in the island/story that renders it.
export function TextFilter({
  value,
  onInput,
  placeholder = "Filter…"
}: {
  value: string;
  onInput: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <input
      type="search"
      value={value}
      placeholder={placeholder}
      onInput={(e) => onInput((e.target as HTMLInputElement).value)}
    />
  );
}

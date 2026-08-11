// Text filter: an input writing into a shared `query` signal. Markup only —
// styling belongs to the site's CSS.
export function createTextFilter({query, placeholder = "Filter…"}) {
  const input = document.createElement("input");
  input.type = "search";
  input.placeholder = placeholder;
  input.value = query.value;
  input.addEventListener("input", () => (query.value = input.value));
  return {node: input};
}

// Structural composition: a panel wrapping arbitrary child component nodes.
export function createFilterPanel({title, children = []}) {
  const section = document.createElement("section");
  const heading = document.createElement("h2");
  heading.textContent = title;
  section.append(heading, ...children);
  return {node: section};
}

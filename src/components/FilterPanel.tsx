import type {ComponentChildren} from "preact";

// Structural composition: a panel nesting arbitrary children.
export function FilterPanel({title, children}: {title: string; children: ComponentChildren}) {
  return (
    <section>
      <h2>{title}</h2>
      {children}
    </section>
  );
}

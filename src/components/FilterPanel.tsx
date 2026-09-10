import type { ComponentChildren } from "preact";
import clsx from "clsx";

// Structural composition: a panel nesting arbitrary children.
export default function FilterPanel({
  title,
  children,
  class: className,
}: {
  title: string;
  children: ComponentChildren;
  class?: string;
}) {
  return (
    <section class={clsx("filter-panel", className)}>
      <h2>{title}</h2>
      {children}
    </section>
  );
}

import clsx from "clsx";

// Pure presentational: receives the already-filtered items.
export default function OrgList({
  items,
  class: className,
}: {
  items: string[];
  class?: string;
}) {
  return (
    <ul class={clsx("org-list", className)}>
      {items.map((name) => (
        <li key={name}>{name}</li>
      ))}
    </ul>
  );
}

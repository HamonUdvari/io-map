// Pure presentational: receives the already-filtered items.
export function OrgList({items}: {items: string[]}) {
  return (
    <ul>
      {items.map((name) => (
        <li key={name}>{name}</li>
      ))}
    </ul>
  );
}

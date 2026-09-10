import type { Meta, StoryObj } from "@storybook/preact-vite";
import { useSignal } from "@preact/signals";
import FilterPanel from "./FilterPanel";
import TextFilter from "./TextFilter";
import OrgList from "./OrgList";
import { organisationsIn } from "../lib/orgs.js";

const meta = {
  title: "UI/FilterPanel",
  component: FilterPanel,
} satisfies Meta<typeof FilterPanel>;

export default meta;
type Story = StoryObj<typeof meta>;

export const WithPlainChildren: Story = {
  args: { title: "Organisations", children: <p>Any children compose here.</p> },
};

// The composition case on the real dataset: a text filter and the full 2025 list
// wired through one story-local signal — neither child knows the other.
function ComposedPanel({ title }: { title: string }) {
  const query = useSignal("");
  const items = organisationsIn(2025).filter((d) =>
    d.toLowerCase().includes(query.value.toLowerCase()),
  );
  return (
    <FilterPanel title={title}>
      <TextFilter value={query.value} onInput={(v) => (query.value = v)} />
      <OrgList items={items} />
    </FilterPanel>
  );
}

export const FilterWithList: Story = {
  args: { title: "Organisations", children: null },
  render: (args) => <ComposedPanel title={args.title} />,
};

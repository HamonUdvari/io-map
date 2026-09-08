import type {Meta, StoryObj} from "@storybook/preact-vite";
import {useSignal} from "@preact/signals";
import {FilterPanel} from "./FilterPanel";
import {TextFilter} from "./TextFilter";
import {OrgList} from "./OrgList";
import {DEMO_ORGS} from "./demo-orgs.js";

const meta = {
  title: "UI/FilterPanel",
  component: FilterPanel
} satisfies Meta<typeof FilterPanel>;

export default meta;
type Story = StoryObj<typeof meta>;

export const WithPlainChildren: Story = {
  args: {title: "Organisations", children: <p>Any children compose here.</p>}
};

// The composition case: a text filter and a list wired through one story-local
// signal — neither child knows the other.
function ComposedPanel({title}: {title: string}) {
  const query = useSignal("");
  const items = DEMO_ORGS.filter((d) => d.toLowerCase().includes(query.value.toLowerCase()));
  return (
    <FilterPanel title={title}>
      <TextFilter value={query.value} onInput={(v) => (query.value = v)} />
      <OrgList items={items} />
    </FilterPanel>
  );
}

export const FilterWithList: Story = {
  args: {title: "Organisations", children: null},
  render: (args) => <ComposedPanel title={args.title} />
};

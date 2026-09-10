import type { Meta, StoryObj } from "@storybook/preact-vite";
import { useSignal } from "@preact/signals";
import CategoryFilter from "./CategoryFilter";

const meta = {
  title: "UI/CategoryFilter",
  component: CategoryFilter,
  argTypes: {
    // wired to the story-local signal, not the args — hide the dead controls
    selected: { table: { disable: true } },
    onToggle: { table: { disable: true } },
  },
} satisfies Meta<typeof CategoryFilter>;

export default meta;
type Story = StoryObj<typeof meta>;

// Filter-chip semantics: nothing selected = no filter (all data shown), so all
// pills start inactive; clicking marks a chip active and narrows the filter.
function Bound() {
  const selected = useSignal<string[]>([]);
  const toggle = (id: string) => {
    selected.value = selected.value.includes(id)
      ? selected.value.filter((c) => c !== id)
      : [...selected.value, id];
  };
  return <CategoryFilter selected={selected.value} onToggle={toggle} />;
}

export const Interactive: Story = {
  args: { selected: [], onToggle: () => {} },
  render: () => <Bound />,
};

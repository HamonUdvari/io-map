import type { Meta, StoryObj } from "@storybook/preact-vite";
import { useSignal } from "@preact/signals";
import TextFilter from "./TextFilter";

const meta = {
  title: "UI/TextFilter",
  component: TextFilter,
  argTypes: {
    // wired to the story-local signal — hide the dead controls
    value: { table: { disable: true } },
    onInput: { table: { disable: true } },
  },
} satisfies Meta<typeof TextFilter>;

export default meta;
type Story = StoryObj<typeof meta>;

// Bound to a local signal so typing works; state stays story-local.
function Bound({ placeholder }: { placeholder?: string }) {
  const value = useSignal("");
  return (
    <TextFilter
      placeholder={placeholder}
      value={value.value}
      onInput={(next) => (value.value = next)}
    />
  );
}

export const Interactive: Story = {
  args: { value: "", onInput: () => {}, placeholder: "Filtrer" },
  render: (args) => <Bound placeholder={args.placeholder} />,
};

import type {Meta, StoryObj} from "@storybook/preact-vite";
import {useSignal} from "@preact/signals";
import {TextFilter} from "./TextFilter";

const meta = {
  title: "UI/TextFilter",
  component: TextFilter,
  args: {value: "", placeholder: "Filter…", onInput: () => {}}
} satisfies Meta<typeof TextFilter>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

// Bound to a local signal so typing works; state stays story-local.
function Controlled(props: {placeholder?: string}) {
  const value = useSignal("");
  return <TextFilter {...props} value={value.value} onInput={(v) => (value.value = v)} />;
}

export const Interactive: Story = {
  render: (args) => <Controlled placeholder={args.placeholder} />
};

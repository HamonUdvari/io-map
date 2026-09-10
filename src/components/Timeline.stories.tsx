import type { Meta, StoryObj } from "@storybook/preact-vite";
import { useSignal } from "@preact/signals";
import Timeline from "./Timeline";

const meta = {
  title: "UI/Timeline",
  component: Timeline,
  argTypes: {
    // wired to the story-local signal, not the args — hide the dead controls
    value: { table: { disable: true } },
    onChange: { table: { disable: true } },
  },
} satisfies Meta<typeof Timeline>;

export default meta;
type Story = StoryObj<typeof meta>;

// Bound to a story-local signal: drag the thumb, click the track, or focus the
// thumb and use arrows / PageUp / PageDown / Home / End.
function Bound(props: { min?: number; max?: number }) {
  const value = useSignal(1965);
  return (
    <Timeline
      {...props}
      value={value.value}
      onChange={(v) => (value.value = v)}
    />
  );
}

export const Interactive: Story = {
  args: { min: 1920, max: 2026, value: 1965, onChange: () => {} },
  render: (args) => <Bound min={args.min} max={args.max} />,
};

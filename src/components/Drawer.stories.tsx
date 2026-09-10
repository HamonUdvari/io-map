import type { Meta, StoryObj } from "@storybook/preact-vite";
import Drawer from "./Drawer";

const meta = {
  title: "UI/Drawer",
  component: Drawer,
  parameters: { layout: "fullscreen" },
  argTypes: {
    // uncontrolled in the story; header/children are slots — hide the controls
    state: { table: { disable: true } },
    onStateChange: { table: { disable: true } },
    header: { table: { disable: true } },
    children: { table: { disable: true } },
  },
} satisfies Meta<typeof Drawer>;

export default meta;
type Story = StoryObj<typeof meta>;

// On the page the drawer fills the 1fr row of the viewport-high overlay grid;
// the story recreates that container, clipped like the overlay.
export const Interactive: Story = {
  render: () => (
    <div class="grid h-dvh grid-rows-[auto_1fr] overflow-clip">
      <div class="p-2 text-io-sm">(nav row)</div>
      <Drawer header={<span>Organisations (44/200)</span>}>
        {Array.from({ length: 40 }, (_, i) => (
          <div class="table-item p-2">Organisation {i + 1}</div>
        ))}
      </Drawer>
    </div>
  ),
  globals: { viewport: { value: "mobile1", isRotated: false } },
};

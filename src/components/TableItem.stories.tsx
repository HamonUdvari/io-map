import type { Meta, StoryObj } from "@storybook/preact-vite";
import TableItem from "./TableItem";

const meta = {
  title: "UI/TableItem",
  component: TableItem,
  // a drawer-width list, so wrapping and striping read like on the site
  decorators: [
    (Story) => <ul class="table-list max-w-[24.375rem]">{Story()}</ul>,
  ],
  argTypes: {
    category: {
      control: "select",
      options: ["pr", "ngo", "io", undefined],
    },
  },
} satisfies Meta<typeof TableItem>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Interactive: Story = {
  args: {
    name: "Agency of Cultural and Technical Cooperation (ACCT)",
    category: "pr",
    right: "100m",
  },
};

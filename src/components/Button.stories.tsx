import type { Meta, StoryObj } from "@storybook/preact-vite";
import Button from "./Button";

const meta = {
  title: "UI/Button",
  component: Button,
  argTypes: {
    children: { control: "text" },
  },
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Simple: Story = {
  args: { children: "Click me" },
};

export const AsLink: Story = {
  args: {
    children: "Mapping Multilateral Geneva",
    href: "https://example.org",
  },
};

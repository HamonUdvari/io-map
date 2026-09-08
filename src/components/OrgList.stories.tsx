import type {Meta, StoryObj} from "@storybook/preact-vite";
import {OrgList} from "./OrgList";
import {DEMO_ORGS} from "./demo-orgs.js";

const meta = {
  title: "UI/OrgList",
  component: OrgList
} satisfies Meta<typeof OrgList>;

export default meta;
type Story = StoryObj<typeof meta>;

export const All: Story = {args: {items: DEMO_ORGS}};

export const Few: Story = {
  args: {items: DEMO_ORGS.filter((d) => d.toLowerCase().includes("international"))}
};

export const Empty: Story = {args: {items: []}};

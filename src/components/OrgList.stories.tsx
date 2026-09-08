import type {Meta, StoryObj} from "@storybook/preact-vite";
import {OrgList} from "./OrgList";
import {organisationsIn} from "../lib/orgs.js";

const meta = {
  title: "UI/OrgList",
  component: OrgList
} satisfies Meta<typeof OrgList>;

export default meta;
type Story = StoryObj<typeof meta>;

const ACTIVE_2025 = organisationsIn(2025);

// Real-data edge cases: the full modern list (scroll), the eight founding-era
// entries, the longest names in the dataset (overflow), one item, none.
export const Active2025: Story = {args: {items: ACTIVE_2025}};

export const Founding1920: Story = {args: {items: organisationsIn(1920)}};

export const LongestNames: Story = {
  args: {items: [...ACTIVE_2025].sort((a, b) => b.length - a.length).slice(0, 10)}
};

export const Single: Story = {args: {items: ACTIVE_2025.slice(0, 1)}};

export const Empty: Story = {args: {items: []}};

import type { Meta, StoryObj } from "@storybook/preact-vite";
import Table from "./Table";
import { pointsIn, categoryKey } from "../lib/orgs.js";

const meta = {
  title: "UI/Table",
  component: Table,
} satisfies Meta<typeof Table>;

export default meta;

// Real dataset rows: the geocoded organisations active in `year`, like the
// site's drawer. `distances` demoes the optional right-side info column.
export const Interactive: StoryObj<{ year: number; distances: boolean }> = {
  args: { year: 2025, distances: false },
  argTypes: {
    year: { control: { type: "range", min: 1920, max: 2026, step: 1 } },
    distances: { name: "right-side info (demo)" },
  },
  render: (args) => (
    <Table
      items={pointsIn(args.year)
        .sort((a: any, b: any) => a.nameEN.localeCompare(b.nameEN))
        .map((d: any, i: number) => ({
          name: d.nameEN,
          category: categoryKey(d),
          right: args.distances ? `${(i % 5) * 100 || 50}m` : undefined,
        }))}
    />
  ),
};

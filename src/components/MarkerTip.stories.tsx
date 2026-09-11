import type { Meta, StoryObj } from "@storybook/preact-vite";
import MarkerTip from "./MarkerTip";
import { pointsIn, categoryKey } from "../lib/orgs.js";

const meta = {
  title: "UI/MarkerTip",
  component: MarkerTip,
  // the floating card on the dark map surface; static position for the story
  decorators: [
    (Story) => (
      <div class="background p-4">
        <div class="map-tip" style={{ position: "static" }}>
          {Story()}
        </div>
      </div>
    ),
  ],
  argTypes: {
    items: { table: { disable: true } },
    more: { table: { disable: true } },
  },
} satisfies Meta<typeof MarkerTip>;

export default meta;

// Real orgs; `count` simulates a cluster of that size (rows cap at 8, the
// rest becomes "+ N more"); clear `address` for the cluster look.
export const Interactive: StoryObj<{ count: number; address: string }> = {
  args: { count: 5, address: "Palais des Nations" },
  argTypes: {
    count: { control: { type: "range", min: 1, max: 20, step: 1 } },
  },
  render: (args) => {
    const members = pointsIn(2025).slice(0, args.count);
    const items = members
      .slice(0, 8)
      .map((d: any) => ({ name: d.nameEN, category: categoryKey(d) }));
    return (
      <MarkerTip
        items={items}
        address={args.address || null}
        more={Math.max(0, args.count - items.length)}
      />
    );
  },
};

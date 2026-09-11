import type { Meta, StoryObj } from "@storybook/preact-vite";
import TimelineEntry from "./TimelineEntry";

const meta = {
  title: "UI/TimelineEntry",
  component: TimelineEntry,
  // the category-tinted infobox surface, at the drawer's card width
  decorators: [
    (Story) => <ul class="max-w-[24.375rem] bg-io-pr-500 p-2">{Story()}</ul>,
  ],
} satisfies Meta<typeof TimelineEntry>;

export default meta;
type Story = StoryObj<typeof meta>;

// Afghanistan's real 1936 first mention + the regrouped 1983 double event —
// edit the args to explore titled/untitled events, sources, plain-text refs.
export const Interactive: Story = {
  args: {
    year: 1936,
    events: [
      {
        title: null,
        note:
          "Officially in the list of Permanent Delegations accredited to " +
          "the League. Afghanistan opened an office during the Conference " +
          "on Disarmament in 1932. The delegation was in contact with the " +
          "League Secretariat. However, there was no permanent delegation " +
          "before according to CH authorities",
        sources: [
          {
            label: "UN Archives",
            href: "https://archives.ungeneva.org/communications-with-the-government-of-afghanistan",
          },
          { label: "B1936_jan" },
        ],
      },
      {
        title: "Address changed to 23, Avenue de Beau-Séjour",
        note: "In September 1937",
        sources: [
          {
            label: "UN Archives",
            href: "https://archives.ungeneva.org/",
          },
        ],
      },
    ],
  },
};

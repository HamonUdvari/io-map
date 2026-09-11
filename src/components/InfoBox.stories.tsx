import type { Meta, StoryObj } from "@storybook/preact-vite";
import InfoBox from "./InfoBox";
import {
  orgInfo,
  eventGroups,
  nearestTo,
  demoContent,
} from "../lib/org-info.js";
import { pointsIn } from "../lib/orgs.js";

const meta = {
  title: "UI/InfoBox",
  component: InfoBox,
  parameters: { layout: "fullscreen" },
  argTypes: {
    // derived from the real dataset via the year/name args below
    info: { table: { disable: true } },
    groups: { table: { disable: true } },
    nearest: { table: { disable: true } },
    about: { table: { disable: true } },
    photo: { table: { disable: true } },
    url: { table: { disable: true } },
    absentYear: { table: { disable: true } },
    onSelectNearest: { table: { disable: true } },
  },
} satisfies Meta<typeof InfoBox>;

export default meta;

// static strings — Tailwind's scanner cannot see composed class names
const TINTS: Record<string, string> = {
  pr: "bg-io-pr-500",
  ngo: "bg-io-ngo-500",
  io: "bg-io-io-500",
};

// The real dataset end to end: pick any organisation + year. Afghanistan
// carries the demo about/photo/url content (TODO remove with the mock).
export const Interactive: StoryObj<{ name: string; year: number }> = {
  args: { name: "Afghanistan", year: 2000 },
  argTypes: {
    year: { control: { type: "range", min: 1920, max: 2026, step: 1 } },
  },
  render: (args) => {
    const info = orgInfo(args.name, args.year);
    if (info == null) return <p class="p-2">No such organisation.</p>;
    const demo = demoContent(args.name);
    return (
      <div
        class={`mx-auto flex min-h-dvh max-w-[24.375rem] flex-col ${TINTS[info.key] ?? "bg-io-neutral-500"}`}
      >
        <h2 class="p-2 text-io-title font-bold">
          {info.prefix != null && `[${info.prefix}] `}
          {info.name}
        </h2>
        <InfoBox
          info={info}
          groups={eventGroups(info.history)}
          nearest={nearestTo(args.name, args.year)}
          absentYear={
            pointsIn(args.year).some((d: any) => d.nameEN === args.name)
              ? null
              : args.year
          }
          about={demo?.about}
          photo={demo?.photo}
          url={demo?.url}
        />
      </div>
    );
  },
};

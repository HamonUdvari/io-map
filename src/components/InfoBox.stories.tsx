import type { Meta, StoryObj } from "@storybook/preact-vite";
import InfoBox from "./InfoBox";
import {
  orgInfo,
  orgStatus,
  eventGroups,
  decadeGroups,
  nearestTo,
} from "../lib/org-info.js";

const meta = {
  title: "UI/InfoBox",
  component: InfoBox,
  parameters: { layout: "fullscreen" },
  argTypes: {
    // derived from the real dataset via the year/name args below
    info: { table: { disable: true } },
    groups: { table: { disable: true } },
    status: { table: { disable: true } },
    decades: { table: { disable: true } },
    nearest: { table: { disable: true } },
    photo: { table: { disable: true } },
    url: { table: { disable: true } },
    sourcesHref: { table: { disable: true } },
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

// The real dataset end to end: pick any organisation (by uniqueName) + year.
export const Interactive: StoryObj<{ name: string; year: number }> = {
  args: { name: "Afghanistan", year: 2000 },
  argTypes: {
    year: { control: { type: "range", min: 1920, max: 2026, step: 1 } },
  },
  render: (args) => {
    const info = orgInfo(args.name, args.year);
    if (info == null) return <p class="p-2">No such organisation.</p>;
    const groups = eventGroups(info.history);
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
          status={orgStatus(args.name, args.year)!}
          groups={groups}
          decades={decadeGroups(groups)}
          nearest={nearestTo(args.name, args.year)}
          sourcesHref="#sources"
        />
      </div>
    );
  },
};

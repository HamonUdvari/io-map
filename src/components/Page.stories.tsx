import type { Meta, StoryObj } from "@storybook/preact-vite";
import { useEffect, useMemo } from "preact/hooks";
import { useSignal } from "@preact/signals";
import { signal } from "@preact/signals-core";
import MapCanvas from "./MapCanvas";
import FilterPanel from "./FilterPanel";
import TextFilter from "./TextFilter";
import Table from "./Table";
import { pointsIn, categoryKey, nameMatches } from "../lib/orgs.js";

// The whole page in one story: the live d3 map plus the UI on the real dataset,
// composed exactly like the site — but every signal is story-local, so the Controls
// panel overrides state: scrubbing the year drives the basemap AND the list.
function PageView({ year: yearValue }: { year: number }) {
  const year = useMemo(() => signal(yearValue), []);
  useEffect(() => {
    year.value = yearValue;
  }, [yearValue]);

  const query = useSignal("");
  const items = pointsIn(yearValue)
    .filter((d: any) => nameMatches(d, query.value))
    .sort((a: any, b: any) => a.nameEN.localeCompare(b.nameEN))
    .map((d: any) => ({ name: d.nameEN, category: categoryKey(d) }));

  return (
    <div>
      <MapCanvas year={year} />
      <FilterPanel title="Organisations">
        <TextFilter value={query.value} onInput={(v) => (query.value = v)} />
        <Table items={items} />
      </FilterPanel>
    </div>
  );
}

const meta = {
  title: "Page/Site",
  parameters: { layout: "fullscreen" },
} satisfies Meta;

export default meta;

export const Site: StoryObj<{ year: number }> = {
  args: { year: 2025 },
  argTypes: {
    year: { control: { type: "range", min: 1844, max: 2026, step: 1 } },
  },
  render: (args) => <PageView year={args.year} />,
};

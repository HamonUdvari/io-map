import type {Meta, StoryObj} from "@storybook/preact-vite";
import {useEffect, useMemo} from "preact/hooks";
import {useSignal} from "@preact/signals";
import {signal} from "@preact/signals-core";
import {MapCanvas} from "./MapCanvas";
import {FilterPanel} from "./FilterPanel";
import {TextFilter} from "./TextFilter";
import {OrgList} from "./OrgList";
import {DEMO_ORGS} from "./demo-orgs.js";

// The whole page in one story: the live d3 map plus the UI, composed exactly like
// the site — but every signal is story-local, so the Controls panel overrides state
// (scrub the year!) without touching the site's globals.
function PageView({year: yearValue}: {year: number}) {
  const year = useMemo(() => signal(yearValue), []);
  useEffect(() => {
    year.value = yearValue;
  }, [yearValue]);

  const query = useSignal("");
  const items = DEMO_ORGS.filter((d) => d.toLowerCase().includes(query.value.toLowerCase()));

  return (
    <div>
      <MapCanvas year={year} />
      <FilterPanel title="Organisations">
        <TextFilter value={query.value} onInput={(v) => (query.value = v)} />
        <OrgList items={items} />
      </FilterPanel>
    </div>
  );
}

const meta = {
  title: "Page/Site",
  parameters: {layout: "fullscreen"}
} satisfies Meta;

export default meta;

export const Site: StoryObj<{year: number}> = {
  args: {year: 2025},
  argTypes: {year: {control: {type: "range", min: 1844, max: 2026, step: 1}}},
  render: (args) => <PageView year={args.year} />
};

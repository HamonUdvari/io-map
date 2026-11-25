import { year, YEAR_RANGE } from "../lib/state.js";
import Timeline from "./Timeline";

// Island binding the global year signal to the presentational Timeline.
export default function YearTimeline({ class: className }: { class?: string }) {
  return (
    <Timeline
      value={year.value}
      onChange={(v) => (year.value = v)}
      min={YEAR_RANGE.min}
      max={YEAR_RANGE.max}
      class={className}
    />
  );
}

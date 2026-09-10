import { year } from "../lib/state.js";
import Timeline from "./Timeline";

// Island binding the global year signal to the presentational Timeline.
export default function YearTimeline({ class: className }: { class?: string }) {
  return (
    <Timeline
      value={year.value}
      onChange={(v) => (year.value = v)}
      class={className}
    />
  );
}

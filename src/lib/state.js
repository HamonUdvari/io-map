// Shared site state as d3-dispatch-backed signals — d3's documented pattern for
// coordinating views (https://d3js.org/d3-dispatch). Assign .value to update every
// subscriber; subscribe with a name so a listener can be replaced individually.
import {dispatch} from "d3";

export function signal(initial) {
  const d = dispatch("change");
  let value = initial;
  return {
    get value() {
      return value;
    },
    set value(next) {
      if (next === value) return;
      value = next;
      d.call("change", null, next);
    },
    on(name, callback) {
      d.on(`change.${name}`, callback);
    }
  };
}

export const year = signal(2025);

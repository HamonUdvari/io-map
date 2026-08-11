import {signal} from "../state.js";
import {createTextFilter} from "./create-text-filter.js";

export default {title: "UI/TextFilter"};

export const Default = {
  render: () => {
    const query = signal("");
    const {node} = createTextFilter({query});
    const out = document.createElement("output");
    out.style.display = "block"; // story-only affordance to show the signal firing
    query.on("story", (v) => (out.textContent = `query signal: "${v}"`));
    const wrap = document.createElement("div");
    wrap.append(node, out);
    return wrap;
  }
};

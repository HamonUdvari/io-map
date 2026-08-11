import {select} from "d3";

let instances = 0;

// Organisation list, re-rendered with a d3 data-join whenever the `query` signal
// changes. The per-instance listener name lets several lists share one signal.
export function createOrgList({items, query}) {
  const ul = document.createElement("ul");
  const render = () => {
    const q = String(query.value ?? "").toLowerCase();
    const filtered = items.filter((d) => d.toLowerCase().includes(q));
    select(ul).selectAll("li").data(filtered, (d) => d).join("li").text((d) => d);
  };
  query.on(`org-list-${++instances}`, render);
  render();
  return {node: ul};
}

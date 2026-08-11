import {signal} from "../state.js";
import {createTextFilter} from "./create-text-filter.js";
import {createOrgList} from "./create-org-list.js";
import {createFilterPanel} from "./create-filter-panel.js";
import {DEMO_ORGS} from "./demo-orgs.js";

export default {title: "UI/FilterPanel"};

// The composition question, live: a text filter inside a panel with a list.
// One shared signal wires the two children — the filter writes it, the list
// subscribes; neither knows the other, the panel just nests their nodes.
export const FilterWithList = {
  render: () => {
    const query = signal("");
    const filter = createTextFilter({query});
    const list = createOrgList({items: DEMO_ORGS, query});
    return createFilterPanel({title: "Organisations", children: [filter.node, list.node]}).node;
  }
};

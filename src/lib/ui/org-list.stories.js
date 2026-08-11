import {signal} from "../state.js";
import {createOrgList} from "./create-org-list.js";
import {DEMO_ORGS} from "./demo-orgs.js";

export default {
  title: "UI/OrgList",
  argTypes: {query: {control: "text"}}
};

const render = ({query}) => createOrgList({items: DEMO_ORGS, query: signal(query)}).node;

export const All = {render, args: {query: ""}};
export const Filtered = {render, args: {query: "international"}};

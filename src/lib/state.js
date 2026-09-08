// Shared site state on @preact/signals-core — one reactive system for both sides:
// the vanilla d3 map subscribes with effect(), Preact components re-render
// automatically when they read .value (via @preact/signals).
export {signal, computed, effect} from "@preact/signals-core";
import {signal} from "@preact/signals-core";

export const year = signal(2025);

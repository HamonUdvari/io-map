// Shared site state on @preact/signals-core — one reactive system for both sides:
// the vanilla d3 map subscribes with effect(), Preact components re-render
// automatically when they read .value (via @preact/signals).
// Re-exported from @preact/signals (not -core): importing state through here
// transitively installs the Preact render integration in every consumer and
// pins a single signals instance.
export { signal, computed, effect } from "@preact/signals";
import { signal } from "@preact/signals";

export const year = signal(2025);

// Explicitly selected categories (filter chips). Empty = no filter = show
// everything — there is deliberately no hide-all state. Consumers apply:
// categories.value.length === 0 || categories.value.includes(c)
/** @type {import("@preact/signals").Signal<string[]>} */
export const categories = signal([]);

// Current map viewport as a lon/lat bbox [w, s, e, n]; null until the map
// first renders. Written (debounced) by MapCanvas, read by the org table.
/** @type {import("@preact/signals").Signal<number[] | null>} */
export const mapBbox = signal(null);

// Name filter text; "" = no filter. Matching is case- and accent-
// insensitive (orgs.js nameMatches) — applied by the table and the markers.
/** @type {import("@preact/signals").Signal<string>} */
export const query = signal("");

// Selected organisation (nameEN, the dataset's stable identifier) — set by
// clicking a marker dot, cleared by clicking the map background. Non-null
// switches the drawer from the table to the infobox.
/** @type {import("@preact/signals").Signal<string | null>} */
export const selectedOrg = signal(null);

// Bumped on every dot click — re-clicking the already-selected dot is a
// same-value signal write (no notify), but the drawer must still reopen.
/** @type {import("@preact/signals").Signal<number>} */
export const selectEpoch = signal(0);

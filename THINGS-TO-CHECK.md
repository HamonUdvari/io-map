# Things to check

Running list of data questions and assumptions to verify, mostly findings from integrating the
10 June 2026 dataset (`docs/data/io-map-v2.csv`). Items for the partners are phrased as questions.

## Questions for the partners (Sohnee et al.)

- [ ] **Silent changes without event markers** — 257 changes happen between consecutive rows with
      no `event` set: 155 representative changes, 102 address changes. Are these missing events?
      Examples: Albania 1938 (*25, rue Lefort → 8, Route de Malagnou*, no `addressChange`),
      Algeria 1970 (representative → *"vacant"*, no event), Armenia 1998 (address change, no event).
- [ ] **`source1 = "no"` vs blank** — 1,857 rows say literally `no`, 1,046 are blank. Same meaning?
      96% of the `"no"` rows sit *between* documented years (continuity gap-fill), clustering in the
      1980s (771) and 1990s (836). Will those decades' Blue Books be processed later, i.e. are these
      rows upgradeable to documented?
- [ ] **Source abbreviations** — confirm: `B1955` / `B1995_April` = UN Geneva *Blue Book* editions?
      Also: `AG1976`/`AG76`, `YB1970-71`, `1958_June_Dec`, generic `"UN Archives"`.
- [ ] **Post-2000 thinning** — yearly entries drop sharply after 2000 (B-codes: 714 rows in the
      1970s vs 151 in the 2000s). Sampling by design, or archive coverage limit?
- [ ] **Novel event values** — `nameChangeFR` and `"Becomes UN related organization"` appear once
      each; confirm the intended event vocabulary (our cleaning normalizes known spellings:
      `addressChange`, `nameChange`, `representativeChange`, `moved`, `closed`, `established`, `vacant`).
- [ ] **Sources pasted into notes** — some rows have a blank `source1` but archive URLs in `note1`
      (e.g. League of Red Cross Societies 1919, IFRC links). Should these move to the source columns?
- [ ] **Same-year row order** — multiple rows can share (organisation, year) (261 pairs, 527 rows).
      We assume sheet order = chronological within the year (matters when e.g. `representativeChange`
      and `closed` share a year — Egypt 1939, Bulgaria 1940). Correct?
- [ ] **Address typos behind the 7 geocode misses** (see `geocode-misses.csv`):
      *Collonges-Bellerive* → Collonge-Bellerive, *Chêne-Bourgeries* → Chêne-Bougeries,
      *Florrisant* → Florissant, etc.

## Geocoding to audit (issue #8)

- [ ] Street-centroid fallbacks stack distinct addresses on one point: *2/7/16, Crêts de Champel* +
      *14, Crêts-de-Champel* → identical coords; *13/19/11bis, Avenue de Champel* likewise;
      *71, Avenue d'Aire* resolves to the bare street centroid.
- [ ] 25 rows have an empty `addressOSM` (incl. the ILO's 1940 Montreal evacuation — the only
      non-Geneva row) and silently drop off the map; currently indistinguishable from geocode failures.
- [ ] Hand-corrections go into `docs/data/geocode-v2.json` (cached keys are never re-fetched);
      `make geocode-retry` re-attempts the 7 nulls.

## Assumptions our code makes (validate against partner answers)

- [ ] Timeline (`docs/event-timeline.html`): organisations without a `closed` event are drawn as
      active until the end of the timeline (2025) — even where yearly entries stop around 2000.
- [ ] Map (`docs/io-map-v2.html`): latest event `moved` = relocated outside Geneva → unplotted;
      `closed` → unplotted until a later row reappears.
- [ ] Closed/moved detection depends on exact spellings; a future "Closed down" / "fermé" would
      pass through with only a stderr warning from `scripts/clean-data.js`.
- [ ] `nameEN` is the canonical, stable key per organisation (renames are events, the column
      doesn't change) — dedup and timeline grouping rely on this.
- [ ] InfoBox work (issue #1): only ~9% of `source1` values are URLs — render B-codes as plain
      citation text and filter out `"no"`.

## Site / infrastructure

- [ ] Stamen/Stadia tile options in the v1 PoC notebooks 403 on the public site (issue #10).
- [ ] swisstopo Zeitreise has no SLA (best effort) — fine for research; have the OSM fallback for demos.
- [ ] `docs/data/zeitreise-editions.json` + `swisstopo-layers.json` are Geneva-probed snapshots;
      re-run `make zeitreise-editions` / `make swisstopo-layers` if swisstopo republishes series.

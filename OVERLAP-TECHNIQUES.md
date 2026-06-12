# Handling co-located points — reference examples

Techniques for points sharing the same spot/building (issues #3, #4). Context: at the 2025 state,
112 of 223 plotted organisations share coordinates with another; worst stack is 10 organisations at
the Palais des Nations. Two distinct cases: **genuinely identical** (same building — show
multiplicity honestly) vs **falsely identical** (street-centroid geocode fallback — fix the data,
issue #8).

Links verified via web search on 2026-06-11. Observable Plot and d3 are both built into our
notebook-kit setup.

## A. Aggregate — one symbol per location ("N orgs here")

### Proportional symbols (size ∝ count)
- [Plot: Proportional symbol scatterplot](https://observablehq.com/@observablehq/plot-proportional-symbol-scatterplot) — official Plot example (dot mark + `r` channel)
- [Plot dot mark docs](https://observablehq.com/plot/marks/dot) — includes the geographic bubble-map pattern (`Plot.geoCentroid` + `r`)
- [Proportional symbols / Nicolas Lambert (neocartocnrs)](https://observablehq.com/@neocartocnrs/prop) — cartographer's take, `bertin`/geoviz ecosystem

### Cluster donut / pie at a location (composition by org type)
- [Donut chart / D3](https://observablehq.com/@d3/donut-chart/2) — the arc generator to place at each building
- [Markercluster pie charts (gist)](https://gist.github.com/gisminister/10001728) — Leaflet markercluster + D3 pies as cluster icons (old but the canonical pattern)

### Building footprint fill (the cartographic answer for Palais des Nations)
- [OSM Overpass API / pbogden](https://observablehq.com/@pbogden/osm-overpass-api) — fetching OSM geometry from a notebook (several variants exist: @scott-petersen, @easz)
- [Overpass API by Example (OSM wiki)](https://wiki.openstreetmap.org/wiki/Overpass_API/Overpass_API_by_Example) — query `building` polygons for our addresses
- Our data hook: `locationBuilding` column (712 rows) names the buildings explicitly

### 3D columns (count as height)
- [deck.gl ColumnLayer example](https://deck.gl/gallery/column-layer) + [docs](https://deck.gl/docs/api-reference/layers/column-layer)
- [Getting started with deck.gl / Xiaoji Chen](https://observablehq.com/@pessimistress/deck-gl-tutorial) — deck.gl from a notebook
- Probably off-style for io-map; listed for completeness

## B. Displace — one dot per organisation, moved apart

### Spiderfy / explode on demand
- [Hello Overlapping Marker Spiderfier for Leaflet / Fati CHEN](https://observablehq.com/@stardisblue/hello-overlapping-marker-spiderfier-for-leaflet) — the click-to-fan-out interaction
- [Stacking Chips (CARTO blog)](https://carto.com/blog/stacking-chips-a-map-hack/) — neat alternative: stack same-location points like poker chips
- Note: identical coordinates never split in plain marker clustering — spiderfy exists precisely for this

### Point displacement (ring/grid around the true point — classic GIS)
- [QGIS Point Displacement renderer docs](https://docs.qgis.org/3.44/en/docs/user_manual/working_with_vector/vector_properties.html) — reference implementation (ring / concentric rings / grid placement); easy to replicate in d3 with `symbol angle = i * 2π/n`
- [QgsPointDisplacementRenderer API](https://api.qgis.org/api/classQgsPointDisplacementRenderer.html) — placement math reference

### Force-collision dodging
- [Collision detection / D3](https://observablehq.com/@d3/collision-detection/2) — `d3.forceCollide` basics (also ships in our own notebook-kit gallery: `/notebook-kit/ex/d3/collision-detection`)
- [Collision-free scatter plot / Klaus Eckelt](https://observablehq.com/@keckelt/collision-free-scatter-plot) — forceX/forceY toward true position + forceCollide, exactly the map-dodging recipe
- [Scatterplot overplotting / John Alexis Guerra Gómez](https://observablehq.com/@john-guerra/overlapping-scatterplots) — survey of overplotting fixes incl. force
- [Clustered bubbles / D3](https://observablehq.com/@d3/clustered-bubbles) — force-packed groups

### Beeswarm / dodge (Plot built-in)
- [Plot dodge transform docs](https://observablehq.com/plot/transforms/dodge) — `dodgeY` gives beeswarms without writing a force sim
- [Plot: Dodge cars (beeswarm)](https://observablehq.com/@observablehq/plot-dodge-cars) — official example
- [Beeswarm / D3](https://observablehq.com/@d3/beeswarm/2) — d3 version

### Phyllotaxis / sunflower packing (deterministic, pretty)
- [Force layout phyllotaxis arrangement / D3](https://observablehq.com/@d3/force-layout-phyllotaxis)
- [Phyllotaxis explained / Fil](https://observablehq.com/@fil/phyllotaxis-explained) — the `r = c√n, θ = n·137.5°` math
- [Sunflower phyllotaxis / Jason Davies](https://www.jasondavies.com/sunflower-phyllotaxis/)

### Jitter (cheap; lies about position — avoid for buildings)
- [Avoiding overlaps in jitter plots / James Trimble](https://observablehq.com/@jtrim-ons/avoiding-overlaps-in-jitter-plots) — `spacedJitter` if we ever need it
- [Plot jitter discussion (plot#1542)](https://github.com/observablehq/plot/issues/1542) — status of a built-in jitter transform

## C. Abstract at low zoom

### Marker clustering (zoom-dependent merging — issue #3)
- [Hello d3-marker-cluster / Fati CHEN](https://observablehq.com/@stardisblue/hello-d3-marker-cluster) — ⚠️ the January email cited `@ccnlog/hello-d3-marker-cluster`; the actual notebook is this one (author: @stardisblue)
- [Hello supercluster! / Pierre Ripoll](https://observablehq.com/@pierreleripoll/hello-supercluster) — mapbox/supercluster in a notebook (the industry standard, `getClusters(bbox, zoom)`)
- [supercluster (GitHub)](https://github.com/mapbox/supercluster)
- [Clustering performances: H3 vs supercluster / Julien Colot](https://observablehq.com/@jcolot/clustering-performances-h3-vs-supercluster)
- [QGIS Point Cluster renderer](https://docs.qgis.org/3.44/en/docs/user_manual/working_with_vector/vector_properties.html) — GIS reference (`@cluster_size` badge labels)

### Hexbin / grid binning
- [Hexbin map / D3](https://observablehq.com/@d3/hexbin-map) — Walmart stores; area = count, color = second variable
- [d3-hexbin collection](https://observablehq.com/collection/@d3/d3-hexbin) + [d3-hexbin (GitHub)](https://github.com/d3/d3-hexbin)

### Density / KDE heatmap
- [Plot density mark docs](https://observablehq.com/plot/marks/density) — supports projections (their Walmart-density map is the template); was already in our January additional-visualisations list
- [d3-hexbin & tricontours heatmap / Fil](https://observablehq.com/@fil/d3-hexbin-tricontours-heatmap)

## D. Interaction instead of geometry

### Grouped tooltips (all orgs at a point in one tip)
- [Plot: grouped tips](https://observablehq.com/@observablehq/plot-grouped-tips) — official pattern: aggregate co-located points into one tip listing members
- [Plot tip mark docs](https://observablehq.com/plot/marks/tip) — pointer transform shows only the nearest tip (we already use this on the event timeline to avoid overlapping tips)
- [Plot Tooltip / Mike Freeman](https://observablehq.com/@mkfreeman/plot-tooltip) — older add-on, mostly superseded by the tip mark

### Zoom policy (hybrid)
- Pattern, not a single example: supercluster at low zoom → proportional symbol + count badge at mid zoom → spiderfy/displacement at building zoom. The pieces above compose it.

## Recommended combination for io-map

Group by `locationBuilding ?? coordinates` → proportional symbol with count (A) + grouped tip
listing members (D) by default; spiderfy or ring displacement on click at high zoom (B);
supercluster when zoomed out (C). Fix street-centroid stacks in the geocode cache (issue #8)
before tuning any of this.

# io-map

## Setup
Run `brew bundle install` on MacOS to install project cli tool requirements.

## Website (main artifact)

The website is an [Astro](https://astro.build) site at the repo root (Tailwind v4 CSS-first, d3 as the driver). It reuses the v3 map system from `docs/lib/geneva-map.js` (a vite alias resolves the notebooks' `npm:` imports from node_modules).

UI conventions:

* `src/lib/state.js` – shared state as [@preact/signals-core](https://github.com/preactjs/signals) signals; the d3 map subscribes with `effect()`, Preact components re-render automatically
* `src/components/*.tsx` – presentational Preact components: plain props + callbacks, no signal imports (state binds in islands/stories)
* `src/components/MapCanvas.tsx` – the single d3 seam: mounts `createGenevaMap` in a ref effect; Preact never touches the map's DOM
* `npm run storybook` – component workbench (`@storybook/preact-vite`); `Page/Site` composes the live map + UI with story-local signals (the year Control scrubs the basemap)

```sh
npm install
npm run dev       # site at http://localhost:4321/io-map/
npm run build     # site + notebooks in dist/ (notebooks under dist/notebooks/)
```

Pushes to `main` deploy `dist/` to GitHub Pages via `.github/workflows/deploy.yml`: the site at `/io-map/`, the notebooks at `/io-map/notebooks/`.

## Notebooks

The map experiments live in `docs/` as [Observable Notebooks 2.0](https://observablehq.com/notebook-kit/) (migrated from Observable v1 notebooks). Built with [Notebook Kit](https://observablehq.com/notebook-kit/kit).

```sh
npm run notebooks:preview   # live preview at http://localhost:5173
```

### v3 — map system (current)

The shared map system for all maps going forward lives in `docs/lib/`:

* `docs/lib/geneva-map.js` – map factory: auto-switching swisstopo basemap (Zeitreise editions until the national map 1:25,000 starts in 1956) + a retained tile pyramid, so zooming, panning and year changes crossfade instead of flashing; B/W by default
* `docs/lib/io-data.js` – dataset join/dedup (extracted from io-map-v2), haversine distances, coordinate stacks, deterministic spread offsets

Demo notebooks, one feature each:

* `docs/v3-basemap.html` – the basemap combination and its 1956 cutoff
* `docs/v3-tile-loading.html` – naive vs retained-pyramid tile loading, fly-to comparison
* `docs/v3-overlapping-points.html` – supercluster zoomed out, deterministic spread + grouped tips zoomed in, neutral color for mixed clusters (around the Palais des Nations)
* `docs/v3-nearby-organisations.html` – K nearest organisations with distances per year (hover + click-to-pin)

### Data pipeline

The site uses the partners' formatted dataset (single-sheet xlsx, sheet `ALL`). The pipeline runs offline; its outputs are committed:

```sh
make clean-data XLSX=path/to/dataset.xlsx   # xlsx -> docs/data/io-map-v3.csv (the cleaning report goes to stderr)
make geocode                                # addresses -> docs/data/geocode-v3.json (Nominatim, 1 req/s, cached)
make geocode-audit                          # cross-check against the swisstopo address register -> geocode-audit.csv
```

* Unresolved addresses land in `geocode-misses.csv`.
* To correct a wrong pin, add a line to `docs/data/geocode-overrides.csv` (`addressOSM,lat,lon,note`). The site applies it on top of the cache. Do not edit the cache by hand.
* `node scripts/geocode-audit.js --apply` writes the register position into the cache where Nominatim found only the street.
* `docs/data/io-map-v2.csv` and `docs/data/geocode-v2.json` are frozen snapshots of the June 2026 dataset for the notebooks.

Open data questions and assumptions to verify are tracked in [THINGS-TO-CHECK.md](THINGS-TO-CHECK.md).

* `docs/io-map-v2.html` – previous main notebook: new dataset (1920–2025), category/sub-filters, year slider, historical overlays

### v1 proof of concept (archive)

* `docs/index.html` – landing page linking all experiments
* `docs/io-map.html` – main notebook: historical map overlays + organizations by year
* `docs/zoomable-geneva-map-tiles.html` – d3-tile + d3-zoom basics
* `docs/static-geneva-raster-tiles.html` – static Mercator raster tiles
* `docs/static-geneva-raster-tiles-image-overlay.html` – georeferenced 1943 map overlay
* `docs/bubble-map.html` – geojson points on static tiles
* `docs/zoomable-geneva-bubble-map-tiles.html` – geojson points through pan/zoom
* `docs/io-map-notes.html` – georeferencing workflow notes
* `docs/data/` – file attachments (geojson, georeferenced PNGs, CSV snapshot of the Google Sheets data)

## Links
* [Dropbox](https://www.dropbox.com/scl/fo/pl7eo43xryw1usl79rt72/AChH2c0Gpqk0rr9It6SsPkQ?rlkey=sm1h9nfe7760dpollqzwfe21j&st=xtk30t5i&dl=0)
* [Reference – Compare two periods](https://www.ge200.ch/carto/comparer-2-epoques)
* [Carte IGN 1935-1949](https://www.ge200.ch/carto/carte-ign-150000-1935-1949)
* [Carte IGN 1969-1972](https://www.ge200.ch/carto/carte-ign-150000-1969-1972)
* [Carte IGN 1999-2006](https://www.ge200.ch/carto/carte-ign-150000-1999-2006)
* [Plan SITG Actuel](https://www.ge200.ch/carto/plan-sitg-actuel)

### Notes
* [QGIS Quickstart Video](https://www.youtube.com/watch?v=SovdBaus7pM)
    * [Quick Map Services Plugin](https://youtu.be/SovdBaus7pM?t=1334)
    * [Change projection](https://youtu.be/SovdBaus7pM?t=1457)
* [QGIS Georeferencing](https://www.youtube.com/watch?v=XV62QEk0Cxg)

### Tech Examples
* [Zoomable web tiles with d3](https://observablehq.com/@d3/zoomable-map-tiles?collection=@d3/d3-tile)
* [D3 tile demos](https://observablehq.com/collection/@d3/d3-tile)

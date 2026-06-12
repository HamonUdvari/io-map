# io-map

## Setup
Run `brew bundle install` on MacOS to install project cli tool requirements.

## Notebooks

The interactive maps live in `docs/` as [Observable Notebooks 2.0](https://observablehq.com/notebook-kit/) (migrated from Observable v1 notebooks). Built with [Notebook Kit](https://observablehq.com/notebook-kit/kit).

```sh
npm install
npm run preview   # live preview at http://localhost:5173
npm run build     # static site in docs/.observable/dist
```

Pushes to `main` deploy the built site to GitHub Pages via `.github/workflows/deploy.yml`.

### v2 data pipeline

The v2 notebook uses the partners' formatted dataset (single-sheet xlsx). The pipeline runs offline; its outputs are committed:

```sh
make data   # xlsx -> docs/data/io-map-v2.csv -> docs/data/geocode-v2.json (Nominatim, 1 req/s, cached)
```

Set `XLSX=path/to/file.xlsx` to point at a newer dataset export. Unresolved addresses land in `geocode-misses.csv`; hand-corrections to `docs/data/geocode-v2.json` survive re-runs (cached keys are never re-fetched).

Open data questions and assumptions to verify are tracked in [THINGS-TO-CHECK.md](THINGS-TO-CHECK.md).

* `docs/io-map-v2.html` – **current**: new dataset (1920–2025), category/sub-filters, year slider, historical overlays

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

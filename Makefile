SHELL := /bin/bash -o pipefail
.DELETE_ON_ERROR:

MAPS_CSV := maps.csv
# The partners' xlsx is not in the repo: pass it with XLSX=path/to/dataset.xlsx
XLSX ?=
SHEET ?= ALL
DATA_CSV := docs/data/io-map-v3.csv

dl-maps:
	@echo "Downloading maps from $(MAPS_CSV)..."
	@mkdir -p assets
	@csvcut -c filename,imageLink $(MAPS_CSV) | csvformat -TE | awk -F'\t' '{print "wget -O assets/"$$1" "$$2}' | bash

# Data pipeline: xlsx -> clean CSV -> geocode cache -> audit.
# io-map-v2.csv and geocode-v2.json are frozen snapshots for the notebooks.
data: clean-data geocode

# The xlsx is not a prerequisite: its file name can contain parentheses, which make
# reads as archive members.
clean-data:
	@test -f "$(XLSX)" || { echo "XLSX not found: '$(XLSX)' (pass XLSX=path/to/dataset.xlsx)"; exit 1; }
	in2csv --sheet "$(SHEET)" "$(XLSX)" | node scripts/clean-data.js > $(DATA_CSV).tmp
	mv $(DATA_CSV).tmp $(DATA_CSV)

# Incremental, 1 request/s against Nominatim; cached addresses are skipped
geocode:
	node scripts/geocode.js

geocode-retry:
	node scripts/geocode.js --retry-failed

# Cross-check every address against the swisstopo address register (slow: 20 requests/min)
geocode-audit:
	node scripts/geocode-audit.js

# Detect the years in which the swisstopo Zeitreise basemap actually changed around Geneva
zeitreise-editions:
	node scripts/zeitreise-editions.js

# Refresh per-layer timestamps (with Geneva coverage) for the historical-basemap demo
swisstopo-layers:
	node scripts/swisstopo-layers.js

.PHONY: dl-maps data clean-data geocode geocode-retry geocode-audit zeitreise-editions swisstopo-layers

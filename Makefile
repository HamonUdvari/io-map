MAPS_CSV := maps.csv
XLSX ?= $(HOME)/Downloads/SampleDataset_10June.xlsx

dl-maps:
	@echo "Downloading maps from $(MAPS_CSV)..."
	@mkdir -p assets
	@csvcut -c filename,imageLink $(MAPS_CSV) | csvformat -TE | awk -F'\t' '{print "wget -O assets/"$$1" "$$2}' | bash

# v2 data pipeline: xlsx -> clean CSV -> geocode cache (incremental, 1 req/s against Nominatim)
data: docs/data/io-map-v2.csv geocode

docs/data/io-map-v2.csv: $(XLSX) scripts/clean-data.js
	in2csv --sheet SampleDataset "$(XLSX)" | node scripts/clean-data.js > $@

geocode: scripts/geocode.js
	node scripts/geocode.js

.PHONY: dl-maps data geocode

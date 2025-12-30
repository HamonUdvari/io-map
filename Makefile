MAPS_CSV := map-sources.csv

dl-maps:
	@echo "Downloading maps from $(MAPS_CSV)..."
	@mkdir -p assets
	@csvcut -c filename,imageLink maps.csv | csvformat -TE | awk -F'\t' '{print "wget -O assets/"$$1" "$$2}' | bash


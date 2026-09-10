// The real dataset, shared by the site and Storybook: the committed v2 CSV parsed
// once at module load (vite inlines it at build time — ~1.2 MB; switch to a fetch
// if bundle size ever matters). Selectors reuse the notebooks' io-data logic so the
// lists show exactly what the map logic considers active.
import csvText from "../../docs/data/io-map-v2.csv?raw";
import { csvParse, autoType } from "d3";
import { latestStateByYear } from "../../docs/lib/io-data.js";

export const rows = csvParse(csvText, autoType);

// Distinct organisations active in `year` (latest state per org; closed/moved drop out).
export function organisationsIn(year) {
  return latestStateByYear(rows, year)
    .map((d) => d.nameEN)
    .sort((a, b) => a.localeCompare(b));
}

import { useEffect } from "preact/hooks";
import { useSignal } from "@preact/signals";
import { buildPrint, PRINT_PARAMS } from "../lib/print-map.js";

type Result = Awaited<ReturnType<typeof buildPrint>>;

type Download = { id: string; label: string; name: string; url: string };

// Island of /print/: builds the print image of one year (query: ?year=1927
// &frame=wide&size=3600) and offers it as files. Utility page, not part of the
// site navigation; scripts/export-print.js drives it headless.
// TODO(design): interim markup — this page is a tool, it has no design.
export default function PrintExport() {
  const params = new URLSearchParams(location.search);
  const year = Number(params.get("year") ?? 1927);
  const frame = params.get("frame") ?? "wide";
  const size = Number(params.get("size") ?? PRINT_PARAMS.size);

  const progress = useSignal("Loading the basemap tiles…");
  const result = useSignal<Result | null>(null);
  const downloads = useSignal<Download[]>([]);
  const failed = useSignal<string | null>(null);

  useEffect(() => {
    if (!(frame in PRINT_PARAMS.frames)) {
      failed.value = `Unknown frame "${frame}". Use: ${Object.keys(PRINT_PARAMS.frames).join(", ")}.`;
      return;
    }
    let urls: string[] = [];
    buildPrint({
      year,
      frame,
      size,
      onProgress: (done: number, total: number) =>
        (progress.value = `Loading the basemap tiles… ${done}/${total}`),
    }).then(
      (r) => {
        const base = `geneva-${year}-${frame}`;
        const files: [string, string, string, Blob][] = [
          ["download-svg", "SVG, basemap embedded", `${base}.svg`, new Blob([r.svgEmbedded], { type: "image/svg+xml" })],
          ["download-svg-linked", "SVG, basemap as a linked file", `${base}-linked.svg`, new Blob([r.svgLinked], { type: "image/svg+xml" })],
          ["download-basemap-dark", "Basemap, site tone (PNG)", `${base}-basemap-dark.png`, r.basemapDark],
          ["download-basemap-original", "Basemap, original colours (PNG)", `${base}-basemap-original.png`, r.basemapOriginal],
        ];
        downloads.value = files.map(([id, label, name, blob]) => {
          const url = URL.createObjectURL(blob);
          urls.push(url);
          return { id, label, name, url };
        });
        result.value = r;
      },
      (error) => (failed.value = String(error?.message ?? error)),
    );
    return () => urls.forEach((url) => URL.revokeObjectURL(url));
  }, []);

  const r = result.value;
  return (
    <main class="print-export" data-print-ready={r != null ? "" : undefined}>
      <form method="get" class="print-export-controls">
        <label>
          Year <input type="number" name="year" min="1920" max="2026" value={year} />
        </label>
        <label>
          Frame{" "}
          <select name="frame">
            {Object.entries(PRINT_PARAMS.frames).map(([key, f]) => (
              <option value={key} selected={key === frame}>
                {key} ({f.sideKm} km)
              </option>
            ))}
          </select>
        </label>
        <button type="submit">Render</button>
      </form>

      {failed.value != null && <p role="alert">{failed.value}</p>}
      {failed.value == null && r == null && <p>{progress.value}</p>}

      {r != null && (
        <>
          <p id="print-stats" data-stats={JSON.stringify({ ...r, svgEmbedded: undefined, svgLinked: undefined, basemapDark: undefined, basemapOriginal: undefined })}>
            {r.year}: {r.total} organisations in the frame ({Object.entries(r.counts).map(([id, n]) => `${id} ${n}`).join(", ")}).{" "}
            {r.outside} outside the frame, {r.withoutAddress} without address. Basemap: {r.basemapLabel}, tile level {r.tileZoom}
            {r.missingTiles > 0 && `, ${r.missingTiles} tiles missing`}. Output: {r.size} px = {PRINT_PARAMS.inches} in at {Math.round(r.size / PRINT_PARAMS.inches)} dpi.
          </p>
          <ul class="print-export-downloads">
            {downloads.value.map((d) => (
              <li>
                <a id={d.id} href={d.url} download={d.name}>
                  {d.label}
                </a>
              </li>
            ))}
          </ul>
          <img id="print-preview" class="print-export-preview" src={downloads.value[0]?.url} alt={`Map of ${r.year}`} />
        </>
      )}
    </main>
  );
}

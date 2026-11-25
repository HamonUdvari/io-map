// Print export: one still image of the map for a year, as a layered SVG — an
// embedded basemap raster, then one group of dots for each category, then the
// Graduate Institute on top. No UI, no labels, no clusters: every organisation
// is one dot, and organisations at one address spread into a small cloud.
// Runs in the browser (it needs canvas for the basemap); /print/ is its page and
// scripts/export-print.js drives it headless.
import { presentIn } from "./orgs.js";
import { TONE } from "./tile-tone.js";
import { basemapForYear } from "../../docs/lib/geneva-map.js";
import { groupByCoordinate, stackOffsets } from "../../docs/lib/io-data.js";
import editions from "../../docs/data/zeitreise-editions.json";
import layersData from "../../docs/data/swisstopo-layers.json";

// Every knob of the export. Sizes are in output px (3600 px = 12 in at 300 dpi).
// TODO(design): frame, sizes and colours are first values to react to.
export const PRINT_PARAMS = {
  size: 3600,
  inches: 12,
  // square frames: centre [lon, lat] and side length. One frame serves the three
  // years, so the images compare.
  frames: {
    wide: { center: [6.14, 46.212], sideKm: 11.9 }, // all organisations of 1927, 1975, 2025 but one
    city: { center: [6.14, 46.212], sideKm: 8 }, // 99 % of them, more detail
  },
  dotRadius: 14,
  dotStroke: 2.5,
  jitterRadius: 30, // spread of organisations that share one address
  institute: { radius: 30, stroke: 6, ringRadius: 48, ringStroke: 5 },
  // draw order = paint order: the most numerous category first, the Institute last
  groups: [
    {
      id: "non-governmental-organisations",
      category: "Non-governmental Organisation",
      fill: "#7fc97f",
    },
    {
      id: "permanent-representations",
      category: "Permanent Representation",
      fill: "#fdc086",
    },
    {
      id: "international-organisations",
      category: "International Organisation",
      fill: "#beaed4",
    },
  ],
  instituteGroup: {
    id: "graduate-institute",
    category: "Special Category",
    fill: "#f0027f", // placeholder — the fourth category has no colour yet
  },
  stroke: "#f8f8f8",
  concurrency: 8, // parallel tile requests
};

// Web-Mercator position in world px at zoom z (256 px tiles).
function worldPx([lon, lat], z) {
  const n = 256 * 2 ** z;
  const s = Math.sin((lat * Math.PI) / 180);
  return [
    ((lon + 180) / 360) * n,
    (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * n,
  ];
}

// The zoom at which `sideKm` on the ground spans `size` px, and the frame's
// top-left corner in world px at that zoom.
function frameGeometry({ center, sideKm }, size) {
  const metersPerPx = (sideKm * 1000) / size;
  const zoom = Math.log2(
    (156543.03392 * Math.cos((center[1] * Math.PI) / 180)) / metersPerPx,
  );
  const [cx, cy] = worldPx(center, zoom);
  return { zoom, left: cx - size / 2, top: cy - size / 2 };
}

const escapeXml = (s) =>
  String(s).replace(
    /[&<>"]/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c],
  );

const toBlob = (canvas) =>
  new Promise((resolve, reject) =>
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("toBlob failed"))),
      "image/png",
    ),
  );

const toDataUrl = (blob) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });

// The basemap of the frame, stitched from swisstopo tiles: once in the original
// colours and once in the site's dark tone (tile-tone.js, same math).
async function renderBasemap(year, geometry, size, onProgress) {
  const layer = basemapForYear(year, { editions, layersData });
  // the next finer tile level, scaled down; a frame within 1 % of a level uses it as is
  const tileZoom = Math.min(18, Math.ceil(geometry.zoom - 0.01));
  const scale = 2 ** (geometry.zoom - tileZoom);
  const tilePx = 256 * scale;
  const x0 = Math.floor(geometry.left / tilePx);
  const x1 = Math.floor((geometry.left + size) / tilePx);
  const y0 = Math.floor(geometry.top / tilePx);
  const y1 = Math.floor((geometry.top + size) / tilePx);

  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  ctx.imageSmoothingQuality = "high";

  const tiles = [];
  for (let x = x0; x <= x1; x++)
    for (let y = y0; y <= y1; y++) tiles.push([x, y]);
  let done = 0;
  let missing = 0;
  const worker = async () => {
    for (let t = tiles.pop(); t != null; t = tiles.pop()) {
      const [x, y] = t;
      try {
        const response = await fetch(layer.url(x, y, tileZoom));
        if (!response.ok) throw new Error(`tile ${response.status}`);
        const bitmap = await createImageBitmap(await response.blob());
        // +0.5 px overlap hides the seams of scaled tiles
        ctx.drawImage(
          bitmap,
          x * tilePx - geometry.left,
          y * tilePx - geometry.top,
          tilePx + 0.5,
          tilePx + 0.5,
        );
        bitmap.close();
      } catch {
        missing++; // outside the layer's coverage: stays transparent
      }
      onProgress?.(++done, (x1 - x0 + 1) * (y1 - y0 + 1));
    }
  };
  await Promise.all(
    Array.from({ length: PRINT_PARAMS.concurrency }, () => worker()),
  );

  const original = await toBlob(canvas);
  const image = ctx.getImageData(0, 0, size, size);
  const px = image.data;
  for (let i = 0; i < px.length; i += 4) {
    const gray = 0.2126 * px[i] + 0.7152 * px[i + 1] + 0.0722 * px[i + 2];
    const v = Math.max(
      0,
      Math.min(255, TONE.intercept * 255 + TONE.slope * gray),
    );
    px[i] = px[i + 1] = px[i + 2] = v;
  }
  ctx.putImageData(image, 0, 0);
  const dark = await toBlob(canvas);
  return { layer, tileZoom, original, dark, missing };
}

// The dots of the year in frame px, grouped by category. Organisations at one
// coordinate spread deterministically (same input, same layout).
function placeDots(year, geometry, size) {
  const points = presentIn(year).filter((d) => d.lat != null && d.long != null);
  const dots = [];
  let outside = 0;
  for (const members of groupByCoordinate(points).values()) {
    const offsets = stackOffsets(members.length, PRINT_PARAMS.jitterRadius);
    members.forEach((d, i) => {
      const [wx, wy] = worldPx([d.long, d.lat], geometry.zoom);
      const x = wx - geometry.left + offsets[i][0];
      const y = wy - geometry.top + offsets[i][1];
      if (x < 0 || y < 0 || x > size || y > size) outside++;
      else dots.push({ d, x, y });
    });
  }
  return {
    dots,
    outside,
    withoutAddress: presentIn(year).length - points.length,
  };
}

const circle = (dot, r) =>
  `<circle cx="${dot.x.toFixed(1)}" cy="${dot.y.toFixed(1)}" r="${r}"><title>${escapeXml(dot.d.nameEN)}</title></circle>`;

/**
 * @param {{year: number, frame?: string, size?: number, onProgress?: (done: number, total: number) => void}} options
 */
export async function buildPrint({
  year,
  frame = "wide",
  size = PRINT_PARAMS.size,
  onProgress,
}) {
  const P = PRINT_PARAMS;
  const k = size / P.size; // every px size follows a non-default output size
  const geometry = frameGeometry(P.frames[frame], size);
  const basemap = await renderBasemap(year, geometry, size, onProgress);
  const { dots, outside, withoutAddress } = placeDots(year, geometry, size);

  const counts = {};
  const groups = P.groups.map((group) => {
    const members = dots.filter((o) => o.d.filterCategory === group.category);
    counts[group.id] = members.length;
    return (
      `  <g id="${group.id}" fill="${group.fill}" stroke="${P.stroke}" stroke-width="${P.dotStroke * k}">\n` +
      members.map((o) => `    ${circle(o, P.dotRadius * k)}`).join("\n") +
      `\n  </g>`
    );
  });

  const institute = dots.filter(
    (o) => o.d.filterCategory === P.instituteGroup.category,
  );
  counts[P.instituteGroup.id] = institute.length;
  const I = P.institute;
  const instituteGroup =
    `  <g id="${P.instituteGroup.id}">\n` +
    institute
      .map(
        (o) =>
          `    <g>\n` +
          `      <circle cx="${o.x.toFixed(1)}" cy="${o.y.toFixed(1)}" r="${I.ringRadius * k}" fill="none" stroke="${P.instituteGroup.fill}" stroke-width="${I.ringStroke * k}"/>\n` +
          `      <circle cx="${o.x.toFixed(1)}" cy="${o.y.toFixed(1)}" r="${I.radius * k}" fill="${P.instituteGroup.fill}" stroke="${P.stroke}" stroke-width="${I.stroke * k}"><title>${escapeXml(o.d.nameEN)}</title></circle>\n` +
          `    </g>`,
      )
      .join("\n") +
    `\n  </g>`;

  const total = dots.length;
  const description =
    `Organisations of multilateral Geneva in ${year}: ${total} dots. ` +
    `Basemap: ${basemap.layer.label}, edition ${basemap.layer.shownYear}, © swisstopo. ` +
    `Frame: ${P.frames[frame].sideKm} km square, centre ${P.frames[frame].center.join(", ")}.`;

  const svg = (href) =>
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<svg xmlns="http://www.w3.org/2000/svg" width="${P.inches}in" height="${P.inches}in" viewBox="0 0 ${size} ${size}">\n` +
    `  <title>Mapping Multilateral Geneva — ${year}</title>\n` +
    `  <desc>${escapeXml(description)}</desc>\n` +
    `  <g id="basemap">\n    <image width="${size}" height="${size}" href="${href}"/>\n  </g>\n` +
    `${groups.join("\n")}\n${instituteGroup}\n</svg>\n`;

  return {
    year,
    frame,
    size,
    counts,
    total,
    outside, // dots that fall out of the frame
    withoutAddress, // present organisations without a position
    missingTiles: basemap.missing,
    basemapLabel: `${basemap.layer.label} ${basemap.layer.shownYear}`,
    tileZoom: basemap.tileZoom,
    // self-contained (basemap embedded) and linked (basemap as a file beside it)
    svgEmbedded: svg(await toDataUrl(basemap.dark)),
    svgLinked: svg(`geneva-${year}-${frame}-basemap-dark.png`),
    basemapDark: basemap.dark,
    basemapOriginal: basemap.original,
  };
}

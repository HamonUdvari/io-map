// The map tone, baked into each tile ONCE at load with canvas pixel math:
// zero per-frame filtering cost in every browser and identical rendering
// everywhere. This exists because WebKit does not apply CSS filters to SVG
// elements (bugs.webkit.org/show_bug.cgi?id=246106) — both filter-based
// approaches (see the retired variants in global.css) were no-ops on iOS.
//
// The math replicates the original #map-tone SVG filter exactly, in sRGB:
// grayscale via Rec.709 luma, then the linear remap out = intercept + slope·gray
// (ink 0 -> light gray 0.62, paper 1 -> the dark background 0.27).
export const TONE = {
  slope: -0.35,
  intercept: 0.62,
};

const CACHE_MAX = 400; // processed tiles kept alive; evictions revoke blobs
const cache = new Map(); // url -> Promise<blobURL>

export function tonedTileHref(url) {
  if (cache.has(url)) {
    const hit = cache.get(url);
    cache.delete(url); // re-insert -> insertion order doubles as LRU
    cache.set(url, hit);
    return hit;
  }
  const promise = bake(url);
  cache.set(url, promise);
  // a rejected bake must not be cached: one transient network blip would
  // otherwise show the raw colored fallback tile for the whole session
  promise.catch(() => {
    if (cache.get(url) === promise) cache.delete(url);
  });
  if (cache.size > CACHE_MAX) {
    const [oldUrl, oldPromise] = cache.entries().next().value;
    cache.delete(oldUrl);
    oldPromise
      .then((blobUrl) => {
        // never revoke a blob a live tile still displays (blank squares)
        const inUse = [...document.querySelectorAll("image")].some(
          (el) => el.href?.baseVal === blobUrl,
        );
        if (!inUse) URL.revokeObjectURL(blobUrl);
      })
      .catch(() => {});
  }
  return promise;
}

async function bake(url) {
  const response = await fetch(url); // hits the HTTP cache the preloader warms
  if (!response.ok) throw new Error(`tile ${response.status}`);
  const bitmap = await createImageBitmap(await response.blob());
  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(bitmap, 0, 0);
  bitmap.close();
  const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const px = image.data;
  const { slope, intercept } = TONE;
  for (let i = 0; i < px.length; i += 4) {
    const gray = 0.2126 * px[i] + 0.7152 * px[i + 1] + 0.0722 * px[i + 2];
    const v = Math.max(0, Math.min(255, intercept * 255 + slope * gray));
    px[i] = px[i + 1] = px[i + 2] = v;
  }
  ctx.putImageData(image, 0, 0);
  const blob = await new Promise((resolve, reject) =>
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("toBlob failed"))),
      "image/png", // lossless — keeps parity with the reference tight
    ),
  );
  return URL.createObjectURL(blob);
}

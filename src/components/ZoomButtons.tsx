import clsx from "clsx";
import { zoomIn, zoomOut, zoomToFit } from "../lib/state.js";
import Button from "./Button";

// Island: the desktop camera controls (Figma "Desktop Zoom Buttons") —
// zoom out, zoom in, and "Show all" (fit every visible marker). Desktop-only
// visibility is layout's business (index.astro hides it below desktop).
export default function ZoomButtons({ class: className }: { class?: string }) {
  return (
    <div class={clsx("zoom-buttons", className)}>
      <Button class="button-round" aria-label="Zoom out" onClick={zoomOut}>
        −
      </Button>
      <Button class="button-round" aria-label="Zoom in" onClick={zoomIn}>
        +
      </Button>
      <Button class="text-io-sm" onClick={zoomToFit}>
        Show all
      </Button>
    </div>
  );
}

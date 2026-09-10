import { useRef } from "preact/hooks";
import clsx from "clsx";

// Year slider (Figma "year-range"), following the WAI-ARIA slider pattern that
// shadcn/Base UI implement: the thumb is the focusable role=slider element;
// arrows step by 1, PageUp/Down by 10, Home/End jump to the bounds; the track
// supports click-to-jump and pointer-capture dragging.
//
// Positioning: the thumb is center-anchored inside .timeline-range, a rail
// inset by half the thumb width — like a native <input type=range>, it stops
// flush at the track edges without the anchor sliding under the cursor, and
// pointer math measures the same rail so press and render always agree.
export default function Timeline({
  value,
  onChange,
  min = 1920,
  max = 2026,
  label = "Year",
  class: className,
}: {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  label?: string;
  class?: string;
}) {
  const rail = useRef<HTMLDivElement>(null);
  const thumb = useRef<HTMLDivElement>(null);
  const grabOffset = useRef(0);

  const set = (raw: number) => {
    const next = Math.min(max, Math.max(min, Math.round(raw)));
    if (next !== value) onChange(next);
  };

  const valueAt = (e: PointerEvent) => {
    const rect = rail.current!.getBoundingClientRect();
    return (
      min +
      ((e.clientX - grabOffset.current - rect.left) / rect.width) * (max - min)
    );
  };

  const onPointerDown = (e: PointerEvent) => {
    if (e.button !== 0 || !e.isPrimary) return;
    e.preventDefault(); // keep focus on the thumb; no native text selection
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    thumb.current!.focus();
    const onThumb = (e.target as Element).closest?.(".timeline-thumb");
    if (onThumb) {
      // grabbing the thumb must not move it: compensate the grip offset
      const t = thumb.current!.getBoundingClientRect();
      grabOffset.current = e.clientX - (t.left + t.width / 2);
    } else {
      grabOffset.current = 0;
      set(valueAt(e));
    }
  };

  const onPointerMove = (e: PointerEvent) => {
    if ((e.currentTarget as HTMLElement).hasPointerCapture(e.pointerId)) {
      set(valueAt(e));
    }
  };

  const onKeyDown = (e: KeyboardEvent) => {
    const next = {
      ArrowRight: value + 1,
      ArrowUp: value + 1,
      ArrowLeft: value - 1,
      ArrowDown: value - 1,
      PageUp: value + 10,
      PageDown: value - 10,
      Home: min,
      End: max,
    }[e.key];
    if (next === undefined) return;
    e.preventDefault();
    set(next);
  };

  const pct = Math.min(
    100,
    Math.max(0, ((value - min) / Math.max(1, max - min)) * 100),
  );

  return (
    <div class={clsx("timeline", className)}>
      <span aria-hidden="true">{min}</span>

      <div
        class="timeline-track"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
      >
        <div class="timeline-line" aria-hidden="true"></div>
        <div class="timeline-range" ref={rail}>
          <div
            class="timeline-thumb"
            ref={thumb}
            role="slider"
            tabIndex={0}
            aria-label={label}
            aria-orientation="horizontal"
            aria-valuemin={min}
            aria-valuemax={max}
            aria-valuenow={value}
            style={{ left: `${pct}%` }}
            onKeyDown={onKeyDown}
          >
            {value}
          </div>
        </div>
      </div>

      <span aria-hidden="true">{max}</span>
    </div>
  );
}

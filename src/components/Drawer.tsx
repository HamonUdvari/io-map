import { useEffect, useId, useRef } from "preact/hooks";
import { useSignal } from "@preact/signals";
import type { ComponentChildren } from "preact";
import clsx from "clsx";

export type DrawerState = "closed" | "half" | "open";

const useMediaQuery = (query: string) => {
  const match = useSignal(matchMedia(query).matches);
  useEffect(() => {
    const mq = matchMedia(query);
    const onChange = () => (match.value = mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [query]);
  return match.value;
};

// Non-modal bottom sheet with three detents (Figma "Table - Popover"):
// closed = header peek, half = header + a few table rows (the default, so
// mobile shows what is inside), open = fills the grid row. Container only —
// header and children are slots, contents stay uncoupled.
//
// From the desktop breakpoint it is a static panel instead (Figma 47-10512):
// always expanded, no drag, no arrow, never inert. This is a deliberate JS
// branch — inert, the pointer handlers, and the arrow are DOM concerns CSS
// cannot switch, and a resize across the breakpoint must self-heal (a sheet
// left collapsed at tablet width would otherwise stay inert when widened).
//
// Mechanics: the grid places the END state (expanded); .drawer positions the
// detents with translate-y (the CSS translate property — Tailwind v4
// translate-y-* compiles to it, so the drag must write style.translate, not
// transform). Dragging the header first freezes the sheet at its current
// visual offset (it may be mid-transition), then follows the pointer with the
// transition off (data-dragging); release hands back to CSS, which animates
// to the nearest detent. The arrow button and a plain tap on the header jump
// between the extremes (closed <-> open), never the middle detent.
//
// Card gestures (the map-app convention the partners asked for):
// - a quick flick moves one detent in its direction, however short;
// - the content drags the sheet too: below the open detent every touch on it
//   moves the sheet (it cannot scroll there anyway), and at the open detent a
//   pull down from the top of the scroll collapses it. Touch events, because a
//   pointer gesture is lost to the browser as soon as native scrolling starts.
//
// End-of-drag runs on pointerup, pointercancel, or lostpointercapture —
// whichever comes first. Chrome can release the capture before firing
// pointercancel, so none of them may guard on hasPointerCapture; the drag ref
// (with its pointerId) is the single source of truth, and settle() nulls it
// so the late duplicates become no-ops. Without this, a cancelled drag
// strands the sheet between detents.
export default function Drawer({
  state: controlled,
  onStateChange,
  onClose,
  header,
  children,
  class: className,
}: {
  /** controlled detent; omit and the drawer manages its own */
  state?: DrawerState;
  onStateChange?: (state: DrawerState) => void;
  /** renders a close (×) button: alone on desktop (the static panel has no
      detents to collapse to), next to the arrow on mobile */
  onClose?: () => void;
  /** left side of the header row (title, counts, …) */
  header?: ComponentChildren;
  children?: ComponentChildren;
  class?: string;
}) {
  const root = useRef<HTMLElement>(null);
  const headerEl = useRef<HTMLDivElement>(null);
  const contentEl = useRef<HTMLDivElement>(null);
  const contentId = useId();

  // the collapsed peek always shows the WHOLE header: measure it and write
  // --drawer-peek on the drawer — the CSS translate calc and the drag stops
  // both read the variable, so wrapped two-line titles are never clipped
  useEffect(() => {
    const el = root.current;
    const head = headerEl.current;
    if (el == null || head == null) return;
    const ro = new ResizeObserver(() =>
      el.style.setProperty("--drawer-peek", `${head.offsetHeight}px`),
    );
    ro.observe(head);
    return () => ro.disconnect();
  }, []);
  const internal = useSignal<DrawerState>("half");
  const isStatic = useMediaQuery("(min-width: 80rem)"); // = --breakpoint-desktop
  const state = isStatic ? "open" : (controlled ?? internal.value);
  const set = (next: DrawerState) => {
    internal.value = next;
    onStateChange?.(next);
  };

  // active drag; px offsets measure from the expanded position (0 = open).
  // `from` is the detent the drag started at; (lastY, lastT, velocity) track
  // the finger speed in px/ms (positive = downwards) for the flick.
  const drag = useRef<{
    id: number;
    y: number;
    base: number;
    offset: number;
    stops: Record<DrawerState, number>;
    moved: boolean;
    from: DrawerState;
    lastY: number;
    lastT: number;
    velocity: number;
  } | null>(null);

  // resizing across the breakpoint mid-drag removes the handlers — finish
  // the drag here or the inline offset would strand the panel
  useEffect(() => {
    if (isStatic && drag.current) {
      drag.current = null;
      root.current!.style.translate = "";
      root.current!.removeAttribute("data-dragging");
    }
  }, [isStatic]);

  const nearest = (offset: number, stops: Record<DrawerState, number>) =>
    (["open", "half", "closed"] as const).reduce((a, b) =>
      Math.abs(offset - stops[a]) <= Math.abs(offset - stops[b]) ? a : b,
    );

  // where a released drag lands: a flick (fast release) moves one detent in
  // its direction from where the drag started; a slow release snaps to the
  // nearest detent
  const FLICK = 0.5; // px/ms
  const ORDER = ["open", "half", "closed"] as const; // top to bottom
  const landing = (d: NonNullable<typeof drag.current>) => {
    // a finger that rested before lifting is not flicking: move events stop
    // while it is still, so the last measured speed would be stale
    const resting = performance.now() - d.lastT > 80;
    if (resting || Math.abs(d.velocity) < FLICK)
      return nearest(d.offset, d.stops);
    const i = ORDER.indexOf(d.from) + (d.velocity > 0 ? 1 : -1);
    return ORDER[Math.min(ORDER.length - 1, Math.max(0, i))];
  };

  const stopsOf = (el: HTMLElement) => {
    const cs = getComputedStyle(el);
    const px = (v: string) => parseFloat(cs.getPropertyValue(v)); // @property-registered -> computed px
    return {
      open: 0,
      half: Math.max(0, el.clientHeight - px("--drawer-half")),
      closed: Math.max(0, el.clientHeight - px("--drawer-peek")),
    };
  };

  // start following a pointer/finger from the sheet's current visual offset
  const begin = (id: number, clientY: number) => {
    const el = root.current!;
    // freeze at the current visual offset — mid-transition grabs must not
    // jump. Measured geometrically: rect.top includes the live translate,
    // offsetTop is the layout (expanded) position. Parsing cs.translate
    // fails at rest — its computed value keeps calc(100% - …) unresolved.
    // Assumes the offsetParent chain starts at the unscrolled viewport top
    // (true in the overlay grid and the Storybook decorator).
    const y = el.getBoundingClientRect().top - el.offsetTop;
    drag.current = {
      id,
      y: clientY,
      base: y,
      offset: y,
      stops: stopsOf(el),
      moved: false,
      from: state,
      lastY: clientY,
      lastT: performance.now(),
      velocity: 0,
    };
    el.style.translate = `0 ${y}px`;
    el.setAttribute("data-dragging", "");
  };

  const follow = (clientY: number) => {
    const d = drag.current!;
    const dy = clientY - d.y;
    if (Math.abs(dy) > 4) d.moved = true;
    const now = performance.now();
    if (now > d.lastT) {
      // smoothed: one late sample must not decide the flick
      d.velocity =
        0.6 * ((clientY - d.lastY) / (now - d.lastT)) + 0.4 * d.velocity;
      d.lastY = clientY;
      d.lastT = now;
    }
    d.offset = Math.min(d.stops.closed, Math.max(0, d.base + dy));
    root.current!.style.translate = `0 ${d.offset}px`;
  };

  const settle = (next: DrawerState) => {
    drag.current = null;
    root.current!.style.translate = "";
    root.current!.removeAttribute("data-dragging");
    set(next); // last — a throwing onStateChange must not skip the cleanup
  };

  const onPointerDown = (e: PointerEvent) => {
    // no isPrimary guard: a finger resting elsewhere (holding the phone, on
    // the map) must not turn the header dead; drag.current serializes drags
    if (e.button !== 0 || drag.current) return;
    // the arrow button keeps its native click — capturing would retarget it
    if ((e.target as Element).closest("button")) return;
    e.preventDefault(); // no text selection while dragging
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    begin(e.pointerId, e.clientY);
  };

  const onPointerMove = (e: PointerEvent) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    follow(e.clientY);
  };

  const onPointerUp = (e: PointerEvent) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    // moved: flick or snap (landing); plain tap: jump to the far extreme
    settle(d.moved ? landing(d) : state === "open" ? "closed" : "open");
  };

  const onPointerCancel = (e: PointerEvent) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    settle(nearest(d.offset, d.stops));
  };

  // Touch on the content moves the sheet (see the header comment). The
  // listeners live for the component's life, so they reach the current
  // render's functions and detent through this ref.
  const live = useRef({ state, begin, follow, settle, landing });
  live.current = { state, begin, follow, settle, landing };
  useEffect(() => {
    const el = contentEl.current;
    if (el == null || isStatic) return;
    // touch ids live in their own (negative) range of drag ids — a pointer
    // drag on the header and a touch on the content never answer each other
    const dragId = (t: Touch) => -1 - t.identifier;
    let pending: { id: number; y: number } | null = null;
    const mine = (e: TouchEvent) =>
      [...e.changedTouches].find((t) => t.identifier === pending?.id);
    const start = (e: TouchEvent) => {
      const t = e.changedTouches[0];
      pending =
        drag.current == null && e.touches.length === 1
          ? { id: t.identifier, y: t.clientY }
          : null; // a second finger voids the gesture
    };
    const move = (e: TouchEvent) => {
      const t = mine(e);
      if (t == null || pending == null) return;
      if (drag.current == null) {
        const dy = t.clientY - pending.y;
        if (Math.abs(dy) < 3) return; // not a drag yet
        // open: the content scrolls; only a pull DOWN from the top of the
        // scroll takes the sheet. Below open, every drag takes it.
        if (live.current.state === "open" && !(dy > 0 && el.scrollTop <= 0)) {
          pending = null;
          return;
        }
        live.current.begin(dragId(t), pending.y);
      }
      if (drag.current?.id !== dragId(t)) return;
      if (e.cancelable) e.preventDefault(); // the sheet moves — nothing scrolls
      live.current.follow(t.clientY);
    };
    const end = (e: TouchEvent) => {
      const t = mine(e);
      if (t == null) return;
      pending = null;
      const d = drag.current;
      if (d == null || d.id !== dragId(t)) return;
      live.current.settle(
        e.type === "touchcancel"
          ? nearest(d.offset, d.stops)
          : live.current.landing(d),
      );
    };
    el.addEventListener("touchstart", start, { passive: true });
    el.addEventListener("touchmove", move, { passive: false });
    el.addEventListener("touchend", end);
    el.addEventListener("touchcancel", end);
    return () => {
      el.removeEventListener("touchstart", start);
      el.removeEventListener("touchmove", move);
      el.removeEventListener("touchend", end);
      el.removeEventListener("touchcancel", end);
    };
  }, [isStatic]);

  return (
    <section class={clsx("drawer", className)} ref={root} data-state={state}>
      <div
        class="drawer-header"
        ref={headerEl}
        onPointerDown={isStatic ? undefined : onPointerDown}
        onPointerMove={isStatic ? undefined : onPointerMove}
        onPointerUp={isStatic ? undefined : onPointerUp}
        onPointerCancel={isStatic ? undefined : onPointerCancel}
        onLostPointerCapture={isStatic ? undefined : onPointerCancel}
      >
        {header}
        {!isStatic && (
          <button
            type="button"
            class="drawer-arrow"
            aria-expanded={state !== "closed"}
            aria-controls={contentId}
            aria-label={state === "open" ? "Collapse" : "Expand"}
            onClick={() => set(state === "open" ? "closed" : "open")}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 16 16"
              fill="none"
              aria-hidden="true"
            >
              <path
                d="M8 14V2M3 7l5-5 5 5"
                stroke="currentColor"
                stroke-width="1.5"
              />
            </svg>
          </button>
        )}
        {onClose != null && (
          <button
            type="button"
            class="drawer-arrow drawer-close"
            aria-label="Close"
            onClick={onClose}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 16 16"
              fill="none"
              aria-hidden="true"
            >
              <path
                d="M3 3l10 10M13 3L3 13"
                stroke="currentColor"
                stroke-width="1.5"
              />
            </svg>
          </button>
        )}
      </div>

      <div
        class="drawer-content"
        ref={contentEl}
        id={contentId}
        inert={state === "closed"}
        // at half most content sits below the viewport and nothing can
        // scroll it into view — expand when focus moves there (keyboard tab)
        onFocusIn={() => state === "half" && set("open")}
      >
        {children}
      </div>
    </section>
  );
}

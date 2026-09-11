import { useEffect, useRef } from "preact/hooks";
import clsx from "clsx";
import TimelineEntry, { type TimelineEvent } from "./TimelineEntry";
import Table, { type TableRow } from "./Table";

export type OrgInfo = {
  name: string;
  category: string;
  key?: string | null;
  prefix?: string | null;
  region?: string | null;
  address?: string | null;
  building?: string | null;
  representative?: string | null;
  activity: string;
  /** the year the meta describes (latest row <= viewed year) */
  at?: number;
  firstYear?: number;
};

// Selected organisation detail (Figma 49-7140), rendered in the drawer's
// content slot on the category-tinted surface; the title lives in the drawer
// header. Pure presentational: data in via props (org-info.js derivations),
// photo/about/url render only when provided — the client columns for those
// come later.
export default function InfoBox({
  info,
  groups,
  nearest,
  absentYear,
  onSelectNearest,
  onHoverNearest,
  onJump,
  about,
  photo,
  url,
  class: className,
}: {
  info: OrgInfo;
  groups: { year: number; events: TimelineEvent[] }[];
  nearest: TableRow[];
  /** set when the org doesn't exist in the viewed year (closed/moved gap):
      shows the absence note and hides the (empty) nearest section */
  absentYear?: number | null;
  /** row click in Nearest Organisations (jump to that organisation) */
  onSelectNearest?: (item: TableRow) => void;
  /** row hover in Nearest Organisations (marker echo on the map) */
  onHoverNearest?: (item: TableRow | null) => void;
  /** in-page anchor chip click. At the sheet's half detent the scroller's
      lower part is below the fold and max-scroll can't reach the last
      sections — the host expands the sheet here (Safari doesn't focus links
      on click, so the focusin-expand path never fires there). */
  onJump?: () => void;
  about?: string | null;
  photo?: { src: string; alt: string; credit?: string } | null;
  url?: string | null;
  class?: string;
}) {
  const root = useRef<HTMLDivElement>(null);
  // a freshly opened organisation starts reading from the top — the drawer's
  // scroller is the same element across selections and keeps its position
  useEffect(() => {
    root.current
      ?.closest(".drawer-content")
      ?.scrollTo({ top: 0, behavior: "instant" });
  }, [info.name]);

  return (
    <div class={clsx("infobox", className)} ref={root}>
      {photo != null && (
        <figure class="infobox-photo">
          <img
            src={photo.src}
            alt={photo.alt}
            loading="lazy"
            decoding="async"
          />
          {photo.credit != null && <figcaption>{photo.credit}</figcaption>}
        </figure>
      )}

      {absentYear != null && (
        <p class="infobox-absent">
          {/* TODO(design): absence wording */}
          {info.firstYear != null && absentYear < info.firstYear
            ? `Not yet in Geneva in ${absentYear} — first recorded ${info.firstYear}`
            : `Not present in Geneva in ${absentYear} — last known state ${info.at}`}
        </p>
      )}

      <div class="infobox-meta">
        <p>
          Category: {info.category}
          {info.region != null && (
            <>
              <br />
              {info.region}
            </>
          )}
        </p>
        {/* before the first mention there IS no known state — showing the
            future first row's address/people as current would be wrong */}
        {(absentYear == null ||
          info.firstYear == null ||
          absentYear >= info.firstYear) && (
          <>
            {info.address != null && <p>address: {info.address}</p>}
            {info.building != null && <p>Building: {info.building}</p>}
          </>
        )}
        <p>Activity: {info.activity}</p>
        {info.representative != null &&
          (absentYear == null ||
            info.firstYear == null ||
            absentYear >= info.firstYear) && (
            <p>Representative: {info.representative}</p>
          )}
      </div>

      {about != null && <p class="infobox-about">{about}</p>}

      <h3 class="infobox-anchors-title">In this infobox:</h3>
      <nav class="infobox-anchors" aria-label="In this infobox">
        <a href="#infobox-timeline" onClick={onJump}>
          Timeline
        </a>
        {nearest.length > 0 && (
          <a href="#infobox-nearest" onClick={onJump}>
            Nearest organisations
          </a>
        )}
        {url != null && (
          <a href={url} target="_blank" rel="noreferrer">
            URL <span aria-hidden="true">↗</span>
          </a>
        )}
      </nav>

      <section class="infobox-section" id="infobox-timeline">
        <h3>Timeline</h3>
        <ul role="list">
          {groups.map((group) => (
            <TimelineEntry
              key={group.year}
              year={group.year}
              events={group.events}
            />
          ))}
        </ul>
      </section>

      {/* an empty nearest list (absent year, unmapped address, or filters
          excluding everything) renders no section at all */}
      {nearest.length > 0 && (
        <section class="infobox-section infobox-nearest" id="infobox-nearest">
          <h3>Nearest Organisations</h3>
          <Table
            items={nearest}
            onSelect={onSelectNearest}
            onHover={onHoverNearest}
          />
        </section>
      )}
    </div>
  );
}

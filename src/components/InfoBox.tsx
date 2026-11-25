import { useEffect, useRef } from "preact/hooks";
import clsx from "clsx";
import TimelineEntry, { type TimelineEvent } from "./TimelineEntry";
import Table, { type TableRow } from "./Table";

export type OrgInfo = {
  /** stable identifier (uniqueName) */
  id?: string;
  /** the name carried in the described year */
  name: string;
  category: string;
  key?: string | null;
  prefix?: string | null;
  region?: string | null;
  address?: string | null;
  building?: string | null;
  representative?: string | null;
  activity: string;
  description?: string | null;
  /** the year the meta describes (latest row <= viewed year) */
  at?: number;
  firstYear?: number;
};

/** where the organisation stands in the viewed year (org-info.js orgStatus) */
export type OrgStatus = {
  kind:
    | "present"
    | "present-no-address"
    | "not-yet"
    | "closed"
    | "no-information"
    | "gap";
  label: string;
  year: number;
};

type YearGroup = { year: number; events: TimelineEvent[] };

// from this many timeline years on, the timeline folds into decades
const DECADES_FROM = 9;

// Selected organisation detail (Figma 49-7140), rendered in the drawer's
// content slot on the category-tinted surface; the title lives in the drawer
// header. Pure presentational: data in via props (org-info.js derivations),
// photo/url render only when provided — the client columns for those come
// later.
export default function InfoBox({
  info,
  status,
  groups,
  decades,
  nearest,
  onSelectNearest,
  onHoverNearest,
  onJump,
  photo,
  url,
  sourcesHref,
  class: className,
}: {
  info: OrgInfo;
  status: OrgStatus;
  groups: YearGroup[];
  /** the same groups by decade (org-info.js decadeGroups); long timelines
      fold into these */
  decades?: { decade: number; label: string; groups: YearGroup[] }[];
  nearest: TableRow[];
  /** row click in Nearest Organisations (jump to that organisation) */
  onSelectNearest?: (item: TableRow) => void;
  /** row hover in Nearest Organisations (marker echo on the map) */
  onHoverNearest?: (item: TableRow | null) => void;
  /** in-page anchor chip click. At the sheet's half detent the scroller's
      lower part is below the fold and max-scroll can't reach the last
      sections — the host expands the sheet here (Safari doesn't focus links
      on click, so the focusin-expand path never fires there). */
  onJump?: () => void;
  photo?: { src: string; alt: string; credit?: string } | null;
  url?: string | null;
  /** link to the sources section of the About page (the infobox itself
      carries no sources — client decision) */
  sourcesHref?: string | null;
  class?: string;
}) {
  const root = useRef<HTMLDivElement>(null);
  // a freshly opened organisation starts reading from the top — the drawer's
  // scroller is the same element across selections and keeps its position
  useEffect(() => {
    root.current
      ?.closest(".drawer-content")
      ?.scrollTo({ top: 0, behavior: "instant" });
  }, [info.id ?? info.name]);

  const present =
    status.kind === "present" || status.kind === "present-no-address";
  // before the first mention there IS no known state — showing the future
  // first row's address/people as current would be wrong
  const known = status.kind !== "not-yet";
  const folded = decades != null && groups.length >= DECADES_FROM;
  // the decade that opens: the one the viewed year falls in, else the last
  // decade before it, else the first
  const openDecade =
    decades?.findLast((d) => d.decade <= status.year)?.decade ??
    decades?.[0]?.decade;

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

      {/* TODO(design): the status line — "show if currently closed or not,
          more prominent"; data-status carries the kind for the styling */}
      <p class="infobox-status" data-status={status.kind}>
        {status.label}
      </p>

      {info.description != null && (
        <p class="infobox-about">{info.description}</p>
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
        {known && (
          <>
            {info.address != null && (
              <p>
                {present ? "Address" : `Last known address (${info.at})`}:{" "}
                {info.address}
              </p>
            )}
            {info.building != null && <p>Building: {info.building}</p>}
          </>
        )}
        <p>In the sources: {info.activity}</p>
        {info.representative != null && known && (
          <p>
            {present
              ? "Representative"
              : `Last known representative (${info.at})`}
            : {info.representative}
          </p>
        )}
      </div>

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
        {sourcesHref != null && <a href={sourcesHref}>Sources</a>}
        {url != null && (
          <a href={url} target="_blank" rel="noreferrer">
            URL <span aria-hidden="true">↗</span>
          </a>
        )}
      </nav>

      <section class="infobox-section" id="infobox-timeline">
        <h3>Timeline</h3>
        {!folded && (
          <ul role="list">
            {groups.map((group) => (
              <TimelineEntry
                key={group.year}
                year={group.year}
                events={group.events}
              />
            ))}
          </ul>
        )}
        {folded &&
          decades!.map((d) => (
            // TODO(design): the decade fold — native details/summary
            <details
              class="infobox-decade"
              key={d.decade}
              open={d.decade === openDecade}
            >
              <summary>
                {d.label}{" "}
                <span class="infobox-decade-count">
                  {d.groups.length} {d.groups.length === 1 ? "year" : "years"}
                </span>
              </summary>
              <ul role="list">
                {d.groups.map((group) => (
                  <TimelineEntry
                    key={group.year}
                    year={group.year}
                    events={group.events}
                  />
                ))}
              </ul>
            </details>
          ))}
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

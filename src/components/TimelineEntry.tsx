import clsx from "clsx";

export type TimelineEvent = {
  /** humanized headline; null = untitled (a plain yearly mention) */
  title?: string | null;
  note?: string | null;
  note2?: string | null;
  /** refs with href render as links, without as plain text (Blue Book codes) */
  sources?: { label: string; href?: string }[];
};

// One year of an organisation's history (Figma "TimelineEntry"): bullet dot,
// bold year, then one block per event of that year — regrouping keeps
// same-year changes under a single heading.
export default function TimelineEntry({
  year,
  events,
  class: className,
}: {
  year: number;
  events: TimelineEvent[];
  class?: string;
}) {
  return (
    <li class={clsx("timeline-entry", className)}>
      <span class="timeline-entry-dot" aria-hidden="true"></span>
      <div class="timeline-entry-body">
        <h4 class="timeline-entry-year">{year}</h4>
        {events.map((event, i) => (
          <div class="timeline-entry-event" key={i}>
            {event.title != null && (
              <h5 class="timeline-entry-title">{event.title}</h5>
            )}
            {event.note != null && <p>{event.note}</p>}
            {event.note2 != null && <p>{event.note2}</p>}
            {(event.sources?.length ?? 0) > 0 && (
              <div class="timeline-entry-sources">
                <span>Source</span>
                <p>
                  {event.sources!.map((source, j) => (
                    <span key={j}>
                      {j > 0 && " "}
                      {source.href != null && (
                        <a href={source.href} target="_blank" rel="noreferrer">
                          {source.label}
                        </a>
                      )}
                      {source.href == null && source.label}
                    </span>
                  ))}
                </p>
              </div>
            )}
          </div>
        ))}
      </div>
    </li>
  );
}

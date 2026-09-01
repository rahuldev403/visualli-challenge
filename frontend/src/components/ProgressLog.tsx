import type { ProgressEvent } from "../types";

interface ProgressLogProps {
  events: ProgressEvent[];
}

const PHASE_STYLE: Record<string, string> = {
  repair: "text-danger",
  validated: "text-success",
  "outline-ready": "text-highlight",
};

/**
 * Live phase log fed by the SSE stream. This is the visible payoff of streaming
 * generation: a repair retry, which is otherwise invisible, shows up here as it
 * happens rather than being hidden inside a spinner.
 */
export default function ProgressLog({ events }: ProgressLogProps) {
  if (events.length === 0) return null;

  return (
    <section
      aria-label="Generation progress"
      aria-live="polite"
      className="border-2 border-line bg-inset p-2 shadow-pixel-sm"
    >
      <ul className="space-y-1">
        {events.map((event, index) => {
          const isLast = index === events.length - 1;
          return (
            <li
              key={`${event.phase}-${index}`}
              className={`font-terminal text-base leading-snug ${
                PHASE_STYLE[event.phase] ?? (isLast ? "text-accent" : "text-muted")
              }`}
            >
              <span aria-hidden="true">{isLast ? "▶ " : "✓ "}</span>
              {event.message.toUpperCase()}
              {event.issues && (
                <ul className="mt-1 space-y-0.5 pl-3">
                  {event.issues.map((issue) => (
                    <li key={issue} className="font-terminal text-sm leading-snug text-muted">
                      - {issue}
                    </li>
                  ))}
                </ul>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

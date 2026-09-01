import type { ProgressEvent } from "../types";

interface ProgressLogProps {
  events: ProgressEvent[];
  /** Set once the run has finished, to fade the log out before it is cleared. */
  isDismissing?: boolean;
  /** Marks the final step as still running rather than complete. */
  isRunning?: boolean;
}

const PHASE_STYLE: Record<string, string> = {
  repair: "text-danger",
  validated: "text-success",
  "outline-ready": "text-heading",
};

/**
 * Live phase log fed by the SSE stream. This is the visible payoff of streaming
 * generation: a repair retry, which is otherwise invisible, shows up here as it
 * happens rather than being hidden inside a spinner.
 */
export default function ProgressLog({ events, isDismissing, isRunning }: ProgressLogProps) {
  if (events.length === 0) return null;

  return (
    <section
      aria-label="Generation progress"
      aria-live="polite"
      className={`panel-in border-2 border-line bg-inset p-2.5 shadow-pixel-sm transition-opacity duration-500 ${
        isDismissing ? "opacity-0" : "opacity-100"
      }`}
    >
      <ul className="space-y-1">
        {events.map((event, index) => {
          const isLast = index === events.length - 1;
          return (
            <li
              key={`${event.phase}-${index}`}
              className={`font-terminal text-base leading-snug ${
                PHASE_STYLE[event.phase] ?? (isLast && isRunning ? "text-accent" : "text-muted")
              }`}
            >
              <span aria-hidden="true" className={isLast && isRunning ? "pixel-blink" : undefined}>
                {isLast && isRunning ? "▶ " : "✓ "}
              </span>
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

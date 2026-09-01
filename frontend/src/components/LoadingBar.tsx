interface LoadingBarProps {
  label?: string;
}

/**
 * Indeterminate progress. Generation has no percentage to report — the model
 * finishes when it finishes — so this shows liveness rather than a fake
 * completion estimate.
 */
export default function LoadingBar({ label }: LoadingBarProps) {
  return (
    <div className="flex flex-col gap-1.5" role="status" aria-live="polite">
      {label && (
        <span className="font-terminal text-base uppercase leading-none text-accent">
          {label}
        </span>
      )}
      <div
        className="h-2.5 w-full overflow-hidden border-2"
        style={{ borderColor: "var(--line)", background: "var(--surface-inset)" }}
        aria-hidden="true"
      >
        <div className="pixel-sweep h-full w-1/4" style={{ background: "var(--accent)" }} />
      </div>
    </div>
  );
}

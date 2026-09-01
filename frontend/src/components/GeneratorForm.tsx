import type { FormEvent } from "react";

/** Mirrors the backend guards so the user is told before a request is wasted. */
export const MIN_INPUT_CHARS = 20;
export const MAX_INPUT_CHARS = 12000;

const SAMPLES: { label: string; text: string }[] = [
  {
    label: "SCIENCE",
    text:
      "Photosynthesis is the process by which plants convert light energy into chemical " +
      "energy. Chlorophyll, the green pigment in leaves, absorbs sunlight and passes that " +
      "energy into the reaction. Water drawn up through the roots and carbon dioxide taken " +
      "in through the leaves are consumed as raw inputs. The reaction produces glucose, " +
      "which stores energy the plant can spend later, and releases oxygen as a by-product " +
      "that sustains aerobic life.",
  },
  {
    label: "MEETING",
    text:
      "Sprint planning notes. The team agreed the checkout rewrite is the headline " +
      "deliverable for this sprint. The main blocker is the payment provider sandbox, which " +
      "keeps returning stale tokens and prevents end-to-end testing. Design owes us the " +
      "final mobile mockups on Wednesday before the UI work can be finished. Every action " +
      "item was given an owner and a deadline, and we committed to a release candidate by " +
      "the last Friday of the sprint.",
  },
  {
    label: "ARTICLE",
    text:
      "Remote work moved from a rare perk to a default operating mode for large parts of " +
      "the economy. Distributed teams lean on written, asynchronous updates rather than " +
      "synchronous meetings. Hiring without a commute radius widens the talent pool a " +
      "company can reach, and shrinking the office footprint cuts a large fixed cost. The " +
      "trade-off is onboarding: new joiners lose the incidental learning that came from " +
      "sitting beside experienced colleagues. Most organisations settled on a hybrid " +
      "compromise rather than either extreme.",
  },
];

interface GeneratorFormProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  isLoading: boolean;
}

export default function GeneratorForm({
  value,
  onChange,
  onSubmit,
  isLoading,
}: GeneratorFormProps) {
  const trimmedLength = value.trim().length;
  const tooShort = trimmedLength < MIN_INPUT_CHARS;
  const tooLong = trimmedLength > MAX_INPUT_CHARS;

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!isLoading && !tooShort && !tooLong) onSubmit();
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <label
          htmlFor="source-text"
          className="flex shrink-0 items-center gap-2 whitespace-nowrap font-terminal text-lg uppercase leading-none tracking-wide text-accent"
        >
          <span aria-hidden="true" className="inline-block h-2.5 w-2.5 bg-accent" />
          Input raw data
        </label>
        <div className="flex gap-1">
          {SAMPLES.map((sample) => (
            <button
              key={sample.label}
              type="button"
              onClick={() => onChange(sample.text)}
              disabled={isLoading}
              title={`Load a sample ${sample.label.toLowerCase()} input`}
              className="border-2 border-line bg-inset px-2 py-1 font-terminal text-base uppercase leading-none text-ink hover:bg-highlight hover:text-on-highlight disabled:opacity-50"
            >
              {sample.label}
            </button>
          ))}
        </div>
      </div>

      <textarea
        id="source-text"
        rows={7}
        className="w-full resize-none border-2 border-line bg-inset p-3 font-terminal text-lg leading-relaxed text-ink focus:border-accent focus:outline-none"
        placeholder="Paste an article, blog post or meeting notes..."
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={isLoading}
      />

      <div className="flex items-center justify-between font-terminal text-base">
        <span className={tooLong ? "text-danger" : "text-muted"}>
          {trimmedLength.toLocaleString()} / {MAX_INPUT_CHARS.toLocaleString()} chars
        </span>
        {tooShort && trimmedLength > 0 && (
          <span className="text-muted">{MIN_INPUT_CHARS - trimmedLength} more to go</span>
        )}
        {tooLong && <span className="text-danger">Too long to summarise</span>}
      </div>

      <button
        type="submit"
        disabled={isLoading || tooShort || tooLong}
        className="pixel-btn w-full bg-highlight py-2.5 font-pixel text-xs font-bold uppercase tracking-wider text-on-highlight disabled:cursor-not-allowed disabled:bg-muted disabled:text-surface"
      >
        {isLoading ? ">>> PROCESSING..." : "► COMPILE MAP"}
      </button>
    </form>
  );
}

import type { MindmapSummary } from "../types";

interface HistoryListProps {
  items: MindmapSummary[];
  activeId: string | null;
  onSelect: (id: string) => void;
}

const formatDate = (iso: string) => {
  const date = new Date(iso);
  return Number.isNaN(date.getTime())
    ? ""
    : date.toLocaleString(undefined, {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
};

export default function HistoryList({ items, activeId, onSelect }: HistoryListProps) {
  return (
    <section aria-label="Previous mindmaps" className="flex min-h-0 flex-col">
      <h2 className="mb-2 border-b-2 border-line pb-1.5 font-pixel text-[9px] uppercase leading-relaxed tracking-widest text-muted">
        History ({items.length})
      </h2>

      {items.length === 0 ? (
        <p className="font-terminal text-base leading-snug text-muted">
          No mindmaps saved yet. Generate one and it will appear here.
        </p>
      ) : (
        <ul className="min-h-0 space-y-1 overflow-y-auto">
          {items.map((item) => {
            const isActive = item.id === activeId;
            return (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => onSelect(item.id)}
                  aria-current={isActive ? "true" : undefined}
                  className={`w-full border-2 border-line px-2 py-1.5 text-left transition-colors ${
                    isActive ? "bg-accent text-on-accent" : "bg-inset text-ink hover:bg-node-hover"
                  }`}
                >
                  <span className="block truncate font-terminal text-lg leading-snug">
                    {item.title}
                  </span>
                  <span
                    className={`block font-terminal text-sm ${
                      isActive ? "text-on-accent" : "text-muted"
                    }`}
                  >
                    {formatDate(item.createdAt)}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

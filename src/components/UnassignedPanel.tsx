import { usePlanStore } from "@/lib/plan-store";
import { Star, Accessibility, X } from "lucide-react";

interface Props {
  selectedGuestId: string | null;
  onSelect: (id: string | null) => void;
}

export function UnassignedPanel({ selectedGuestId, onSelect }: Props) {
  const guests = usePlanStore((s) => s.guests.filter((g) => !g.tableId));

  return (
    <aside className="w-72 shrink-0 border-l border-border bg-sidebar text-sidebar-foreground flex flex-col h-[calc(100vh-4rem)] sticky top-16">
      <div className="p-4 border-b border-sidebar-border">
        <div className="text-xs uppercase tracking-wider text-muted-foreground">
          Unassigned
        </div>
        <div className="font-display text-2xl">{guests.length}</div>
        <p className="text-[11px] text-muted-foreground mt-1">
          Select a guest, then click a seat to place them.
        </p>
      </div>
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {guests.length === 0 && (
          <div className="text-center text-sm text-muted-foreground py-8">
            Everyone is seated 🎉
          </div>
        )}
        {guests.map((g) => {
          const active = selectedGuestId === g.id;
          return (
            <button
              key={g.id}
              onClick={() => onSelect(active ? null : g.id)}
              className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors flex items-start gap-2 ${
                active
                  ? "bg-primary text-primary-foreground"
                  : "hover:bg-accent text-foreground"
              }`}
            >
              <div className="flex-1 min-w-0">
                <div className="truncate font-medium">{g.name}</div>
                {g.company && (
                  <div className={`truncate text-[11px] ${active ? "opacity-80" : "text-muted-foreground"}`}>
                    {g.company}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-1 mt-0.5">
                {g.tags.includes("VIP") && (
                  <Star className={`h-3 w-3 ${active ? "" : "text-vip"} fill-current`} />
                )}
                {g.tags.includes("Wheelchair") && (
                  <Accessibility className="h-3 w-3" />
                )}
              </div>
            </button>
          );
        })}
      </div>
      {selectedGuestId && (
        <div className="p-3 border-t border-sidebar-border">
          <button
            onClick={() => onSelect(null)}
            className="w-full text-xs flex items-center justify-center gap-1 text-muted-foreground hover:text-foreground"
          >
            <X className="h-3 w-3" /> Cancel selection
          </button>
        </div>
      )}
    </aside>
  );
}

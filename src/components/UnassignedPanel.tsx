import { usePlanStore, type RsvpStatus } from "@/lib/plan-store";
import { Star, Accessibility, X, ChevronDown, ChevronRight, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

interface Props {
  selectedGuestId: string | null;
  onSelect: (id: string | null) => void;
  onEditGuest?: (id: string) => void;
}

const RSVP_FILTERS: { label: string; value: "All" | RsvpStatus }[] = [
  { label: "All", value: "All" },
  { label: "Confirmed", value: "Confirmed" },
  { label: "Pending", value: "Pending" },
  { label: "Waitlist", value: "Waitlist" },
];

export function UnassignedPanel({ selectedGuestId, onSelect, onEditGuest }: Props) {
  const allGuests = usePlanStore((s) => s.guests);
  const tables = usePlanStore((s) => s.tables);
  const assignGuest = usePlanStore((s) => s.assignGuest);
  const [filter, setFilter] = useState<"All" | RsvpStatus>("All");
  const [showDeclined, setShowDeclined] = useState(false);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [panelSearch, setPanelSearch] = useState("");

  const unfiltered = useMemo(() => {
    return allGuests.filter((g) => {
      if (g.tableId) return false;
      if (g.rsvpStatus === "Declined" || g.rsvpStatus === "No-show") return showDeclined;
      if (filter === "All") return true;
      return g.rsvpStatus === filter;
    });
  }, [allGuests, filter, showDeclined]);

  const visible = useMemo(() => {
    const q = panelSearch.trim().toLowerCase();
    if (!q) return unfiltered;
    return unfiltered.filter(
      (g) => g.name.toLowerCase().includes(q) || (g.company ?? "").toLowerCase().includes(q),
    );
  }, [unfiltered, panelSearch]);

  const grouped = useMemo(() => {
    const map = new Map<string, typeof visible>();
    visible.forEach((g) => {
      const key = g.cohort?.trim() || "Individual";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(g);
    });
    // sort: cohorts first, Individual last
    return [...map.entries()].sort((a, b) => {
      if (a[0] === "Individual") return 1;
      if (b[0] === "Individual") return -1;
      return a[0].localeCompare(b[0]);
    });
  }, [visible]);

  function seatCohort(ids: string[]) {
    // find a table with enough remaining capacity for the whole cohort
    const counts: Record<string, number> = {};
    allGuests.forEach((g) => {
      if (g.tableId) counts[g.tableId] = (counts[g.tableId] || 0) + 1;
    });
    const sorted = [...tables].sort(
      (a, b) => (b.seats - (counts[b.id] || 0)) - (a.seats - (counts[a.id] || 0)),
    );
    const target = sorted.find((t) => t.seats - (counts[t.id] || 0) >= ids.length);
    if (!target) {
      toast.error("No table has enough free seats for this cohort.");
      return;
    }
    ids.forEach((id) => assignGuest(id, target.id));
    toast.success(`Seated ${ids.length} at table ${target.label}`);
  }

  return (
    <aside className="w-72 shrink-0 border-l border-border bg-sidebar text-sidebar-foreground flex flex-col h-[calc(100vh-4rem)] sticky top-16">
      <div className="p-4 border-b border-sidebar-border">
        <div className="text-xs uppercase tracking-wider text-muted-foreground">Unassigned</div>
        <div className="font-display text-2xl">{visible.filter((g) => g.rsvpStatus !== "Declined" && g.rsvpStatus !== "No-show" && g.rsvpStatus !== "Withdrawn").length}</div>
        <div className="flex flex-wrap gap-1 mt-2">
          {RSVP_FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => setFilter(f.value)}
              className={`text-[10px] px-2 py-0.5 rounded-full border ${
                filter === f.value ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <label className="flex items-center gap-1.5 mt-2 text-[10px] text-muted-foreground cursor-pointer">
          <input type="checkbox" checked={showDeclined} onChange={(e) => setShowDeclined(e.target.checked)} />
          Show declined / no-show
        </label>
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-3">
        {visible.length === 0 && (
          <div className="text-center text-sm text-muted-foreground py-8">Everyone is seated 🎉</div>
        )}
        {grouped.map(([key, list]) => {
          const isCollapsed = collapsed[key];
          return (
            <div key={key}>
              <div className="flex items-center justify-between px-2 py-1">
                <button
                  className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground"
                  onClick={() => setCollapsed((c) => ({ ...c, [key]: !c[key] }))}
                >
                  {isCollapsed ? <ChevronRight className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                  {key} <span className="opacity-60">({list.length})</span>
                </button>
                {key !== "Individual" && list.length > 1 && (
                  <button
                    onClick={() => seatCohort(list.map((g) => g.id))}
                    className="text-[10px] text-primary hover:underline"
                  >
                    Seat together
                  </button>
                )}
              </div>
              {!isCollapsed && (
                <div className="space-y-1">
                  {list.map((g) => {
                    const active = selectedGuestId === g.id;
                    const ghosted = g.rsvpStatus === "Declined" || g.rsvpStatus === "No-show";
                    return (
                      <button
                        key={g.id}
                        onClick={() => onSelect(active ? null : g.id)}
                        disabled={ghosted}
                        className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors flex items-start gap-2 ${
                          active
                            ? "bg-primary text-primary-foreground"
                            : ghosted
                            ? "opacity-50 line-through"
                            : "hover:bg-accent text-foreground"
                        }`}
                      >
                        <div className="flex-1 min-w-0">
                          <div
                            className="truncate font-medium cursor-pointer hover:underline"
                            onClick={(e) => { e.stopPropagation(); onEditGuest?.(g.id); }}
                            title="Click to edit guest details"
                          >
                            {g.name}
                          </div>
                          {g.company && (
                            <div className={`truncate text-[11px] ${active ? "opacity-80" : "text-muted-foreground"}`}>
                              {g.company}
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-1 mt-0.5">
                          {g.rsvpStatus !== "Confirmed" && !ghosted && (
                            <span className="text-[9px] uppercase font-mono px-1 rounded bg-muted text-muted-foreground">
                              {g.rsvpStatus[0]}
                            </span>
                          )}
                          {g.tags.includes("VIP") && (
                            <Star className={`h-3 w-3 ${active ? "" : "text-vip"} fill-current`} />
                          )}
                          {g.tags.includes("Wheelchair") && <Accessibility className="h-3 w-3" />}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
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

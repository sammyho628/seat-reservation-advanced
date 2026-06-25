import { usePlanStore, type RsvpStatus } from "@/lib/plan-store";
import { Star, Accessibility, X, ChevronDown, ChevronRight, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

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
  const updateGuest = usePlanStore((s) => s.updateGuest);
  const [filter, setFilter] = useState<"All" | RsvpStatus>("All");
  const [showDeclined, setShowDeclined] = useState(false);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [panelSearch, setPanelSearch] = useState("");

  const unfiltered = useMemo(() => {
    return allGuests.filter((g) => {
      if (g.isPlaceholder) return false;
      if (g.tableId) return false;
      if (g.rsvpStatus === "Declined" || g.rsvpStatus === "No-show") return showDeclined;
      if (g.rsvpStatus === "Withdrawn") return false;
      if (filter === "All") return true;
      return g.rsvpStatus === filter;
    });
  }, [allGuests, filter, showDeclined]);

  const tbcSeats = useMemo(() => {
    return allGuests
      .filter((g) => g.isPlaceholder && g.tableId)
      .map((g) => ({
        guestId: g.id,
        tableId: g.tableId!,
        seatIndex: g.seatIndex!,
        company: g.company,
        tableLabel: tables.find((t) => t.id === g.tableId)?.label ?? "?",
      }));
  }, [allGuests, tables]);

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

      <div className="px-3 pt-2 pb-1">
        <div className="relative">
          <Search className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            value={panelSearch}
            onChange={(e) => setPanelSearch(e.target.value)}
            placeholder="Search unassigned…"
            className="w-full h-8 pl-8 pr-3 rounded-md border border-input bg-background text-xs focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>
        {panelSearch && (
          <p className="text-[10px] text-muted-foreground pt-1">
            {visible.length} of {unfiltered.length} shown
          </p>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-3">
        {(() => {
          const waitlisted = allGuests.filter((g) => !g.isPlaceholder && g.rsvpStatus === "Waitlist");
          if (waitlisted.length === 0) return null;
          return (
            <div className="mb-1 border border-amber-200 dark:border-amber-800 rounded-lg overflow-hidden">
              <div className="flex items-center justify-between px-3 py-2 bg-amber-50 dark:bg-amber-950/30">
                <span className="text-xs font-medium text-amber-800 dark:text-amber-300 uppercase tracking-wider">
                  Waitlist ({waitlisted.length})
                </span>
                {waitlisted.length > 1 && (
                  <button
                    onClick={() => {
                      waitlisted.forEach((g) => updateGuest(g.id, { rsvpStatus: "Confirmed" }));
                      toast.success(`${waitlisted.length} promoted to Confirmed`);
                    }}
                    className="text-[10px] px-2 py-0.5 rounded bg-amber-600 text-white hover:bg-amber-700"
                  >
                    Promote all
                  </button>
                )}
              </div>
              <div className="divide-y divide-border/60">
                {waitlisted.map((g) => (
                  <div key={g.id} className="flex items-center gap-2 px-3 py-1.5">
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-medium truncate">{g.name}</div>
                      {g.company && <div className="text-[10px] text-muted-foreground truncate">{g.company}</div>}
                    </div>
                    <button
                      onClick={() => {
                        updateGuest(g.id, { rsvpStatus: "Confirmed" });
                        toast.success(`${g.name} promoted to Confirmed`);
                      }}
                      className="shrink-0 text-[10px] px-2 py-0.5 rounded border border-amber-300 text-amber-700 hover:bg-amber-50 dark:hover:bg-amber-950/40"
                    >
                      Promote
                    </button>
                  </div>
                ))}
              </div>
            </div>
          );
        })()}
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
                      <div
                        key={g.id}
                        className={`group/row w-full text-left px-3 py-2 rounded-md text-sm transition-colors flex items-start gap-2 cursor-pointer ${
                          active
                            ? "bg-primary text-primary-foreground"
                            : ghosted
                            ? "opacity-50 line-through"
                            : "hover:bg-accent text-foreground"
                        } ${ghosted ? "pointer-events-none" : ""}`}
                        onClick={() => onSelect(active ? null : g.id)}
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
                          {tbcSeats.length > 0 && !ghosted && (
                            <Popover>
                              <PopoverTrigger asChild>
                                <button
                                  onClick={(e) => e.stopPropagation()}
                                  className="opacity-0 group-hover/row:opacity-100 text-[10px] px-1.5 py-0.5 rounded border border-indigo-200 text-indigo-600 hover:bg-indigo-50 shrink-0 transition-opacity"
                                  title="Assign to a TBC seat"
                                >
                                  → TBC
                                </button>
                              </PopoverTrigger>
                              <PopoverContent className="w-56 p-1" align="end" onClick={(e) => e.stopPropagation()}>
                                <p className="text-[10px] text-muted-foreground px-2 py-1 font-semibold uppercase tracking-wider">Put on TBC seat at…</p>
                                {tbcSeats.map((ts) => (
                                  <button
                                    key={ts.guestId}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      assignGuest(g.id, ts.tableId, ts.seatIndex);
                                      toast.success(`Moved to Table ${ts.tableLabel} · Seat ${ts.seatIndex}`);
                                    }}
                                    className="w-full text-left px-3 py-2 text-sm rounded hover:bg-accent"
                                  >
                                    Table {ts.tableLabel} · Seat {ts.seatIndex}
                                    {ts.company && <span className="text-muted-foreground ml-1">({ts.company})</span>}
                                  </button>
                                ))}
                              </PopoverContent>
                            </Popover>
                          )}
                        </div>
                      </div>
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

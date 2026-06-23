import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { usePlanStore } from "@/lib/plan-store";
import { useMemo, useState } from "react";
import { Search, Check } from "lucide-react";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/checkin")({
  ssr: false,
  head: () => ({ meta: [{ title: "Check-in · Seatcraft" }] }),
  component: CheckinPage,
});

function CheckinPage() {
  const guests = usePlanStore((s) => s.guests);
  const tables = usePlanStore((s) => s.tables);
  const setGuestArrived = usePlanStore((s) => s.setGuestArrived);
  const [q, setQ] = useState("");
  const [tab, setTab] = useState<"all" | "arrived" | "pending">("all");

  const tableLabel = Object.fromEntries(tables.map((t) => [t.id, t.label]));
  const confirmed = useMemo(
    () => guests.filter((g) => g.rsvpStatus === "Confirmed" || g.rsvpStatus === "Waitlist"),
    [guests],
  );
  const arrivedCount = confirmed.filter((g) => g.arrived).length;

  const filtered = confirmed.filter((g) => {
    if (tab === "arrived" && !g.arrived) return false;
    if (tab === "pending" && g.arrived) return false;
    if (!q.trim()) return true;
    const lower = q.toLowerCase();
    return g.name.toLowerCase().includes(lower) || (g.company ?? "").toLowerCase().includes(lower);
  });

  return (
    <AppShell>
      <div className="max-w-3xl mx-auto px-6 py-8">
        <div className="mb-6">
          <h1 className="font-display text-5xl">Check-in</h1>
          <p className="text-muted-foreground mt-1">
            <span className="font-mono text-lg text-foreground">{arrivedCount}</span> of {confirmed.length} expected guests arrived
          </p>
        </div>

        <div className="relative mb-4">
          <Search className="h-5 w-5 absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            autoFocus
            placeholder="Search by name or company…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="pl-12 h-14 text-lg"
          />
        </div>

        <div className="flex gap-2 mb-4">
          {(["all", "pending", "arrived"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2 rounded-md text-sm font-medium ${
                tab === t ? "bg-primary text-primary-foreground" : "border border-input hover:bg-accent"
              }`}
            >
              {t === "all" ? "All" : t === "arrived" ? `Arrived (${arrivedCount})` : `Not yet (${confirmed.length - arrivedCount})`}
            </button>
          ))}
        </div>

        <div className="space-y-2">
          {filtered.map((g) => (
            <button
              key={g.id}
              onClick={() => setGuestArrived(g.id, !g.arrived)}
              className={`w-full text-left p-4 rounded-xl border transition flex items-center gap-4 ${
                g.arrived
                  ? "bg-[color:var(--color-rsvp-confirmed)]/10 border-[color:var(--color-rsvp-confirmed)]/40"
                  : "bg-card border-border hover:border-foreground/40"
              }`}
            >
              <div className={`h-10 w-10 rounded-full flex items-center justify-center ${
                g.arrived ? "bg-[color:var(--color-rsvp-confirmed)] text-white" : "border-2 border-border"
              }`}>
                {g.arrived && <Check className="h-5 w-5" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-display text-xl truncate">{g.name}</div>
                {g.company && <div className="text-sm text-muted-foreground truncate">{g.company}</div>}
              </div>
              <div className="text-right">
                {g.tableId ? (
                  <div className="font-display text-2xl">{tableLabel[g.tableId]}<span className="text-base text-muted-foreground"> · {g.seatIndex}</span></div>
                ) : (
                  <div className="text-xs text-muted-foreground italic">unseated</div>
                )}
                {g.rsvpStatus === "Waitlist" && <div className="text-[10px] uppercase font-mono text-muted-foreground">Waitlist</div>}
              </div>
            </button>
          ))}
          {filtered.length === 0 && (
            <div className="text-center text-muted-foreground py-12">No matches.</div>
          )}
        </div>
      </div>
    </AppShell>
  );
}

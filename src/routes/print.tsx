import { createFileRoute } from "@tanstack/react-router";
import { usePlanStore } from "@/lib/plan-store";
import { useMemo } from "react";
import { Printer } from "lucide-react";
import { Link } from "@tanstack/react-router";

export const Route = createFileRoute("/print")({
  head: () => ({ meta: [{ title: "Print · Seatcraft" }] }),
  component: PrintPage,
});

function PrintPage() {
  const tables = usePlanStore((s) => s.tables);
  const guests = usePlanStore((s) => s.guests);
  const settings = usePlanStore((s) => s.settings);

  const byTable = useMemo(() => {
    const m = new Map<string, typeof guests>();
    tables.forEach((t) => m.set(t.id, []));
    guests.forEach((g) => {
      if (g.tableId && m.has(g.tableId)) m.get(g.tableId)!.push(g);
    });
    m.forEach((list) => list.sort((a, b) => (a.seatIndex ?? 0) - (b.seatIndex ?? 0)));
    return m;
  }, [tables, guests]);

  const alpha = useMemo(
    () => [...guests].filter((g) => g.tableId).sort((a, b) => a.name.localeCompare(b.name)),
    [guests],
  );

  const mealCounts = useMemo(() => {
    const m: Record<string, number> = {};
    guests.forEach((g) => {
      m[g.meal] = (m[g.meal] || 0) + 1;
    });
    return m;
  }, [guests]);

  const tableLabel = Object.fromEntries(tables.map((t) => [t.id, t.label]));

  return (
    <div className="min-h-screen bg-background">
      <div className="no-print sticky top-0 z-30 bg-background/90 backdrop-blur border-b border-border">
        <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link to="/" className="text-sm text-muted-foreground hover:text-foreground">
            ← Back to planner
          </Link>
          <button
            onClick={() => window.print()}
            className="h-9 px-4 rounded-md bg-primary text-primary-foreground text-sm inline-flex items-center gap-1.5"
          >
            <Printer className="h-4 w-4" /> Print
          </button>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-8 py-10 space-y-12">
        {/* Page 1: cover + meal totals */}
        <section className="print-page">
          <h1 className="font-display text-5xl mb-2">{settings.eventTitle}</h1>
          <p className="text-muted-foreground mb-8">Seating Plan · {tables.length} tables · {guests.length} guests</p>

          <h2 className="font-display text-2xl mt-10 mb-3">Kitchen meal counts</h2>
          <table className="w-full max-w-md border border-border">
            <tbody>
              {Object.entries(mealCounts).map(([meal, count]) => (
                <tr key={meal} className="border-t border-border">
                  <td className="p-2">{meal}</td>
                  <td className="p-2 text-right font-mono">{count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        {/* Page 2: alpha lookup */}
        <section className="print-page">
          <h2 className="font-display text-3xl mb-4">Alphabetical guest lookup</h2>
          <div className="grid grid-cols-2 gap-x-8">
            {alpha.map((g) => (
              <div key={g.id} className="flex justify-between border-b border-border/40 py-1 text-sm">
                <span>{g.name}</span>
                <span className="font-mono text-muted-foreground">
                  {tableLabel[g.tableId!]} · {g.seatIndex}
                </span>
              </div>
            ))}
          </div>
        </section>

        {/* Per-table pages */}
        {tables.map((t) => {
          const list = byTable.get(t.id) ?? [];
          return (
            <section key={t.id} className="print-page">
              <div className="border border-border rounded-xl p-8">
                <div className="text-center mb-6">
                  <div className="text-xs uppercase tracking-[0.3em] text-muted-foreground">
                    {settings.eventTitle}
                  </div>
                  <div className="font-display text-6xl mt-2">Table {t.label}</div>
                  <div className="text-muted-foreground mt-1 font-mono text-sm">
                    {list.length} of {t.seats} seated
                  </div>
                </div>
                <table className="w-full">
                  <tbody>
                    {Array.from({ length: t.seats }, (_, i) => i + 1).map((seat) => {
                      const g = list.find((x) => x.seatIndex === seat);
                      return (
                        <tr key={seat} className="border-t border-border/60">
                          <td className="w-12 p-2 font-mono text-muted-foreground">{seat}</td>
                          <td className="p-2 font-medium">
                            {g?.name ?? <span className="text-muted-foreground italic">—</span>}
                          </td>
                          <td className="p-2 text-muted-foreground text-sm">{g?.company ?? ""}</td>
                          <td className="p-2 text-right text-xs font-mono">
                            {g && g.meal !== "None" ? g.meal : ""}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}

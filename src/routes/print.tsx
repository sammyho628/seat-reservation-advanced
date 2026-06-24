import { createFileRoute, Link } from "@tanstack/react-router";
import { usePlanStore } from "@/lib/plan-store";
import { useMemo, useState } from "react";
import { Printer } from "lucide-react";

export const Route = createFileRoute("/print")({
  ssr: false,
  head: () => ({ meta: [{ title: "Print · Seatcraft" }] }),
  component: PrintPage,
});

const MEAL_ICON: Record<string, string> = {
  Chicken: "🍗", Fish: "🐟", Vegetarian: "🥦", Vegan: "🌱", Kids: "👶", None: "—",
};

function PrintPage() {
  const tables = usePlanStore((s) => s.tables);
  const allGuests = usePlanStore((s) => s.guests);
  const settings = usePlanStore((s) => s.settings);
  const [view, setView] = useState<"full" | "kitchen">("full");

  const guests = useMemo(
    () => allGuests.filter((g) => g.rsvpStatus !== "Declined" && g.rsvpStatus !== "No-show"),
    [allGuests],
  );

  const eligibleGuests = useMemo(() => guests.filter((g) => g.tableId), [guests]);

  function exportMailMerge() {
    const rows = [
      ["Name", "FirstName", "LastName", "Company", "Title", "Table", "Seat", "Meal", "Dietary", "Tags", "RSVP"],
      ...eligibleGuests.map((g) => {
        const tbl = tables.find((t) => t.id === g.tableId);
        return [
          g.name,
          g.firstName ?? "",
          g.lastName ?? "",
          g.company ?? "",
          g.title ?? "",
          tbl?.label ?? "",
          String(g.seatIndex ?? ""),
          g.meal,
          g.dietary ?? "",
          g.tags.join("; "),
          g.rsvpStatus,
        ];
      }),
    ];
    const csv = rows
      .map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${settings.eventTitle.replace(/\s+/g, "-").toLowerCase()}-mail-merge.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const byTable = useMemo(() => {
    const m = new Map<string, typeof guests>();
    tables.forEach((t) => m.set(t.id, []));
    guests.forEach((g) => { if (g.tableId && m.has(g.tableId)) m.get(g.tableId)!.push(g); });
    m.forEach((list) => list.sort((a, b) => (a.seatIndex ?? 0) - (b.seatIndex ?? 0)));
    return m;
  }, [tables, guests]);

  const alpha = useMemo(
    () => [...guests].filter((g) => g.tableId).sort((a, b) => a.name.localeCompare(b.name)),
    [guests],
  );

  const mealCounts = useMemo(() => {
    const m: Record<string, number> = {};
    guests.forEach((g) => { m[g.meal] = (m[g.meal] || 0) + 1; });
    return m;
  }, [guests]);

  const tableLabel = Object.fromEntries(tables.map((t) => [t.id, t.label]));

  return (
    <div className="min-h-screen bg-background">
      <div className="no-print sticky top-0 z-30 bg-background/90 backdrop-blur border-b border-border">
        <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link to="/" className="text-sm text-muted-foreground hover:text-foreground">← Back to planner</Link>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setView(view === "kitchen" ? "full" : "kitchen")}
              className="h-9 px-3 rounded-md border border-input text-sm"
            >
              🍽️ {view === "kitchen" ? "Full view" : "Kitchen sheet"}
            </button>
            <button
              onClick={exportMailMerge}
              className="h-9 px-3 rounded-md border border-input text-sm inline-flex items-center gap-1.5 hover:bg-accent"
              title="Export CSV for Word/Excel mail merge"
            >
              📋 Mail merge CSV
            </button>
            <button
              onClick={() => window.print()}
              className="h-9 px-4 rounded-md bg-primary text-primary-foreground text-sm inline-flex items-center gap-1.5"
            >
              <Printer className="h-4 w-4" /> Print
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-8 py-10 space-y-12">
        {/* Header / cover */}
        <section className="print-page">
          <div className="flex items-center gap-4 mb-2">
            {settings.logoDataUrl && <img src={settings.logoDataUrl} alt="" className="h-14" />}
            <div>
              <h1 className="font-display text-5xl">{settings.eventTitle}</h1>
              <p className="text-muted-foreground">Seating Plan · {tables.length} tables · {guests.length} attendees</p>
            </div>
          </div>

          {view === "kitchen" ? (
            <div className="mt-8">
              <h2 className="font-display text-3xl mb-4" style={{ borderBottom: `2px solid ${settings.primaryColor}` }}>Kitchen sheet</h2>
              <table className="w-full text-sm border border-border">
                <thead className="bg-muted">
                  <tr>
                    <th className="text-left p-2">Table</th>
                    {Object.keys(MEAL_ICON).filter((m) => m !== "None").map((m) => (
                      <th key={m} className="p-2 text-2xl">{MEAL_ICON[m]}</th>
                    ))}
                    <th className="text-left p-2">Dietary alerts</th>
                  </tr>
                </thead>
                <tbody>
                  {tables.map((t) => {
                    const list = byTable.get(t.id) ?? [];
                    const counts: Record<string, number> = {};
                    list.forEach((g) => { counts[g.meal] = (counts[g.meal] || 0) + 1; });
                    const diets = list.filter((g) => g.dietary);
                    return (
                      <tr key={t.id} className="border-t border-border">
                        <td className="p-2 font-display text-xl">{t.label}</td>
                        {Object.keys(MEAL_ICON).filter((m) => m !== "None").map((m) => (
                          <td key={m} className="p-2 text-center font-mono text-2xl font-bold">
                            {counts[m] || ""}
                          </td>
                        ))}
                        <td className="p-2 text-xs">
                          {diets.map((g) => (
                            <div key={g.id} className="text-[color:var(--color-violation)]">⚠️ {g.name}: {g.dietary}</div>
                          ))}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <>
              <h2 className="font-display text-2xl mt-10 mb-3">Meal totals</h2>
              <table className="w-full max-w-md border border-border">
                <tbody>
                  {Object.entries(mealCounts).map(([meal, count]) => (
                    <tr key={meal} className="border-t border-border">
                      <td className="p-2">{MEAL_ICON[meal] ?? ""} {meal}</td>
                      <td className="p-2 text-right font-mono">{count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </section>

        {view === "full" && (
          <>
            <section className="print-page">
              <h2 className="font-display text-3xl mb-4">Alphabetical lookup</h2>
              <div className="grid grid-cols-2 gap-x-8">
                {alpha.map((g) => (
                  <div key={g.id} className="flex justify-between border-b border-border/40 py-1 text-sm">
                    <span>{g.name}</span>
                    <span className="font-mono text-muted-foreground">{tableLabel[g.tableId!]} · {g.seatIndex}</span>
                  </div>
                ))}
              </div>
            </section>

            {tables.map((t) => {
              const list = byTable.get(t.id) ?? [];
              return (
                <section key={t.id} className="print-page">
                  <div
                    className="border rounded-xl p-8"
                    style={{ borderColor: settings.primaryColor }}
                  >
                    <div className="text-center mb-6">
                      <div className="text-xs uppercase tracking-[0.3em] text-muted-foreground">{settings.eventTitle}</div>
                      <div className="font-display text-6xl mt-2">Table {t.label}</div>
                      {t.hostName && <div className="text-sm italic text-muted-foreground mt-1">Hosted by {t.hostName}</div>}
                      <div className="text-muted-foreground mt-1 font-mono text-sm">{list.length} of {t.seats} seated</div>
                    </div>
                    <table className="w-full">
                      <tbody>
                        {Array.from({ length: t.seats }, (_, i) => i + 1).map((seat) => {
                          const g = list.find((x) => x.seatIndex === seat);
                          return (
                            <tr key={seat} className="border-t border-border/60">
                              <td className="w-12 p-2 font-mono text-muted-foreground">{seat}</td>
                              <td className="p-2 font-medium">{g?.name ?? <span className="text-muted-foreground italic">—</span>}</td>
                              <td className="p-2 text-muted-foreground text-sm">{g?.company ?? ""}</td>
                              <td className="p-2 text-right text-xs font-mono">{g && g.meal !== "None" ? g.meal : ""}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </section>
              );
            })}

            <section className="print-page">
              <h2 className="font-display text-3xl mb-4 no-print">Place cards (preview)</h2>
              <div className="place-cards-grid">
                {placeCardGuests.map((g) => (
                  <div key={g.id} className="place-card" style={{ borderColor: settings.primaryColor }}>
                    <div className="text-[9pt] text-muted-foreground">{settings.eventTitle}</div>
                    <div>
                      <div className="font-display text-2xl leading-tight">{g.name}</div>
                      {g.company && <div className="text-[10pt] text-muted-foreground">{g.company}</div>}
                      {g.title && <div className="text-[8pt] text-muted-foreground italic">{g.title}</div>}
                    </div>
                    <div className="flex justify-between items-end text-[9pt]">
                      <span>{MEAL_ICON[g.meal] ?? ""} {g.meal !== "None" ? g.meal : ""}</span>
                      <span className="font-mono">{tableLabel[g.tableId!]} · {g.seatIndex}</span>
                    </div>
                    {g.dietary && (
                      <div className="text-[8pt]" style={{ color: "var(--color-dietary-alert)" }}>⚠️ {g.dietary}</div>
                    )}
                  </div>
                ))}
              </div>
            </section>
          </>
        )}
      </div>
    </div>
  );
}

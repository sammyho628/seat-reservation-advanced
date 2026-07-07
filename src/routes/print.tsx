import { createFileRoute, Link } from "@tanstack/react-router";
import { usePlanStore } from "@/lib/plan-store";
import { useMemo, useState } from "react";
import { Printer } from "lucide-react";
import JSZip from "jszip";

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
  const [view, setView] = useState<"full" | "kitchen" | "companies" | "dietary">("full");

  const guests = useMemo(
    () => allGuests.filter((g) => g.rsvpStatus !== "Declined" && g.rsvpStatus !== "No-show"),
    [allGuests],
  );

  const eligibleGuests = useMemo(() => guests.filter((g) => g.tableId && !g.isPlaceholder), [guests]);

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
    () => [...guests].filter((g) => g.tableId && !g.isPlaceholder).sort((a, b) => a.name.localeCompare(b.name)),
    [guests],
  );

  const mealCounts = useMemo(() => {
    const m: Record<string, number> = {};
    guests.forEach((g) => { m[g.meal] = (m[g.meal] || 0) + 1; });
    return m;
  }, [guests]);

  const tableLabel = Object.fromEntries(tables.map((t) => [t.id, t.label]));

  const byCompany = useMemo(() => {
    const m = new Map<string, typeof guests>();
    guests.forEach((g) => {
      if (!g.isPlaceholder) {
        const key = g.company?.trim() || "(No company)";
        if (!m.has(key)) m.set(key, []);
        m.get(key)!.push(g);
      }
    });
    m.forEach((list) =>
      list.sort((a, b) => {
        const ta = tableLabel[a.tableId ?? ""] ?? "z";
        const tb = tableLabel[b.tableId ?? ""] ?? "z";
        if (ta !== tb) return ta.localeCompare(tb);
        return (a.seatIndex ?? 0) - (b.seatIndex ?? 0);
      })
    );
    return [...m.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [guests, tableLabel]);

  async function exportZip() {
    const zip = new JSZip();
    const mmRows = [
      ["Name", "FirstName", "LastName", "Company", "Title", "Table", "Seat", "Meal", "Dietary", "Tags", "RSVP"],
      ...eligibleGuests.map((g) => {
        const tbl = tables.find((t) => t.id === g.tableId);
        return [
          g.name, g.firstName ?? "", g.lastName ?? "", g.company ?? "",
          g.title ?? "", tbl?.label ?? "", String(g.seatIndex ?? ""),
          g.meal, g.dietary ?? "", g.tags.join("; "), g.rsvpStatus,
        ];
      }),
    ];
    const mmCsv = mmRows
      .map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    zip.file("mail-merge.csv", "\uFEFF" + mmCsv);

    const allRows = [
      ["Name", "Company", "Title", "Cohort", "Table", "Seat", "Meal", "Dietary", "RSVP", "Notes", "TBC"],
      ...allGuests
        .filter((g) => g.rsvpStatus !== "Declined" && g.rsvpStatus !== "No-show")
        .map((g) => {
          const tbl = tables.find((t) => t.id === g.tableId);
          return [
            g.name, g.company ?? "", g.title ?? "", g.cohort ?? "",
            tbl?.label ?? "", String(g.seatIndex ?? ""),
            g.meal, g.dietary ?? "", g.rsvpStatus, g.notes ?? "",
            g.isPlaceholder ? "Yes" : "",
          ];
        }),
    ];
    const allCsv = allRows
      .map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    zip.file("all-guests.csv", "\uFEFF" + allCsv);

    const planState = usePlanStore.getState();
    zip.file("plan.seatcraft.json", JSON.stringify(planState, null, 2));

    const blob = await zip.generateAsync({ type: "blob" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const slug = settings.eventTitle.replace(/\s+/g, "-").toLowerCase();
    a.download = `${slug}-export.zip`;
    a.click();
    URL.revokeObjectURL(url);
  }


  return (
    <div className="min-h-screen bg-background">
      <div className="no-print sticky top-0 z-30 bg-background/90 backdrop-blur border-b border-border">
        <div className="max-w-5xl mx-auto px-4 h-12 flex items-center justify-between gap-2">
          <Link to="/" className="text-xs text-muted-foreground hover:text-foreground shrink-0">← Planner</Link>
          <div className="flex items-center gap-1 flex-wrap justify-end">
            <button
              onClick={() => setView("full")}
              className={`h-8 px-2 rounded-md border text-xs whitespace-nowrap ${view === "full" ? "bg-primary text-primary-foreground border-primary" : "border-input"}`}
            >
              📄 Full
            </button>
            <button
              onClick={() => setView("kitchen")}
              className={`h-8 px-2 rounded-md border text-xs whitespace-nowrap ${view === "kitchen" ? "bg-primary text-primary-foreground border-primary" : "border-input"}`}
            >
              🍽️ Kitchen
            </button>
            <button
              onClick={() => setView("companies")}
              className={`h-8 px-2 rounded-md border text-xs whitespace-nowrap ${view === "companies" ? "bg-primary text-primary-foreground border-primary" : "border-input"}`}
            >
              🏢 Company
            </button>
            <button
              onClick={() => setView("dietary")}
              className={`h-8 px-2 rounded-md border text-xs whitespace-nowrap ${view === "dietary" ? "bg-primary text-primary-foreground border-primary" : "border-input"}`}
            >
              🥗 Dietary
            </button>
            <span className="w-px h-5 bg-border mx-1" />
            <button
              onClick={exportMailMerge}
              className="h-8 px-2 rounded-md border border-input text-xs inline-flex items-center gap-1 hover:bg-accent whitespace-nowrap"
              title="Export CSV for Word/Excel mail merge"
            >
              📋 CSV
            </button>
            <button
              onClick={exportZip}
              className="h-8 px-2 rounded-md border border-input text-xs inline-flex items-center gap-1 hover:bg-accent whitespace-nowrap"
              title="Download ZIP: mail-merge CSV + all guests CSV + plan backup"
            >
              📦 ZIP
            </button>
            <button
              onClick={() => window.print()}
              className="h-8 px-3 rounded-md bg-primary text-primary-foreground text-xs inline-flex items-center gap-1 whitespace-nowrap"
            >
              <Printer className="h-3.5 w-3.5" /> Print
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
              <p className="text-muted-foreground">
                {settings.eventDate && (
                  <span>
                    {new Date(settings.eventDate + "T00:00").toLocaleDateString(undefined, { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
                    {settings.eventTime && ` · ${settings.eventTime}`}
                    {settings.eventVenue && ` · ${settings.eventVenue}`}
                    {" — "}
                  </span>
                )}
                Seating Plan · {tables.length} tables · {guests.length} attendees
              </p>
            </div>
          </div>

          {view === "kitchen" && (
            <div className="mt-8">
              <h2 className="font-display text-3xl mb-4" style={{ borderBottom: `2px solid ${settings.primaryColor}` }}>Kitchen sheet</h2>
              <table className="w-full text-sm border border-border">
                <thead className="bg-muted">
                  <tr>
                    <th className="text-left p-3 align-bottom">Table</th>
                    {Object.keys(MEAL_ICON).filter((m) => m !== "None").map((m) => (
                      <th key={m} className="p-2 text-center align-bottom">
                        <div className="flex flex-col items-center gap-0.5">
                          <span className="text-2xl">{MEAL_ICON[m]}</span>
                          <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{m}</span>
                        </div>
                      </th>
                    ))}
                    <th className="text-left p-3 align-bottom">Dietary alerts</th>
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
          )}
          {view === "full" && (
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

        {view === "companies" && (
          <section className="companies-print">
            <h2 className="font-display text-3xl mb-6 no-print">Guest list by company</h2>
            {byCompany.map(([company, list]) => (
              <div key={company} className="mb-8 company-block">
                <table className="w-full text-sm border border-border">
                  <thead>
                    <tr>
                      <th
                        colSpan={7}
                        className="text-left p-0 pb-1"
                        style={{ borderBottom: `2px solid ${settings.primaryColor}` }}
                      >
                        <div className="font-display text-xl pt-2">
                          {company}
                          <span className="text-sm font-sans font-normal text-muted-foreground ml-2">
                            {list.length} guest{list.length !== 1 ? "s" : ""}
                            {" · "}
                            {list.filter((g) => g.tableId).length} seated
                            {list.some((g) => !g.tableId) ? ` · ${list.filter((g) => !g.tableId).length} unassigned` : ""}
                            <span className="print-continued"> (continued)</span>
                          </span>
                        </div>
                      </th>
                    </tr>
                    <tr className="bg-muted text-xs uppercase tracking-wider text-muted-foreground">
                      <th className="text-left p-2">Name</th>
                      <th className="text-left p-2">Title</th>
                      <th className="text-left p-2">Table</th>
                      <th className="text-left p-2">Seat</th>
                      <th className="text-left p-2">Meal</th>
                      <th className="text-left p-2">Dietary</th>
                      <th className="text-left p-2">RSVP</th>
                    </tr>
                  </thead>
                  <tbody>
                    {list.map((g) => (
                      <tr key={g.id} className="border-t border-border/60">
                        <td className="p-2 font-medium">{g.name}</td>
                        <td className="p-2 text-muted-foreground text-xs">{g.title ?? "—"}</td>
                        <td className="p-2 font-mono">{g.tableId ? tableLabel[g.tableId] : <span className="text-amber-600">Unassigned</span>}</td>
                        <td className="p-2 font-mono">{g.seatIndex ?? "—"}</td>
                        <td className="p-2 text-xs">{g.meal !== "None" ? g.meal : "—"}</td>
                        <td className={`p-2 text-xs ${g.dietary ? "text-[color:var(--color-violation)] font-medium" : "text-muted-foreground"}`}>
                          {g.dietary || "—"}
                        </td>
                        <td className="p-2 text-xs">{g.rsvpStatus}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
          </section>
        )}

        {view === "dietary" && (() => {
          const dietaryGuests = allGuests.filter(
            (g) => !g.isPlaceholder && g.dietary && g.dietary.trim() &&
              g.rsvpStatus !== "Declined" && g.rsvpStatus !== "No-show",
          ).sort((a, b) => (tableLabel[a.tableId ?? ""] ?? "").localeCompare(tableLabel[b.tableId ?? ""] ?? ""));
          const specialMealGuests = allGuests.filter(
            (g) => !g.isPlaceholder && g.meal !== "None" && g.meal !== "Chicken" &&
              g.rsvpStatus !== "Declined" && g.rsvpStatus !== "No-show",
          ).sort((a, b) => a.meal.localeCompare(b.meal));
          return (
            <section className="space-y-8 print:space-y-6">
              <div>
                <h2 className="text-lg font-bold mb-3 border-b pb-2">⚠️ Dietary Requirements ({dietaryGuests.length})</h2>
                {dietaryGuests.length === 0 ? (
                  <p className="text-muted-foreground text-sm">No dietary requirements recorded.</p>
                ) : (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs uppercase text-muted-foreground border-b">
                        <th className="py-1 pr-4">Guest</th>
                        <th className="py-1 pr-4">Company</th>
                        <th className="py-1 pr-4">Table · Seat</th>
                        <th className="py-1">Dietary requirement</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dietaryGuests.map((g) => (
                        <tr key={g.id} className="border-b border-border/40">
                          <td className="py-1.5 pr-4 font-medium">{g.name}</td>
                          <td className="py-1.5 pr-4 text-muted-foreground">{g.company ?? "—"}</td>
                          <td className="py-1.5 pr-4 font-mono text-xs">
                            {g.tableId ? `${tableLabel[g.tableId]} · ${g.seatIndex}` : "Unassigned"}
                          </td>
                          <td className="py-1.5 font-medium text-amber-700 dark:text-amber-400">{g.dietary}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
              <div>
                <h2 className="text-lg font-bold mb-3 border-b pb-2">🍽️ Special Meal Choices ({specialMealGuests.length})</h2>
                {specialMealGuests.length === 0 ? (
                  <p className="text-muted-foreground text-sm">No special meal choices.</p>
                ) : (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs uppercase text-muted-foreground border-b">
                        <th className="py-1 pr-4">Meal</th>
                        <th className="py-1 pr-4">Guest</th>
                        <th className="py-1 pr-4">Company</th>
                        <th className="py-1">Table · Seat</th>
                      </tr>
                    </thead>
                    <tbody>
                      {specialMealGuests.map((g) => (
                        <tr key={g.id} className="border-b border-border/40">
                          <td className="py-1.5 pr-4 font-medium">{g.meal}</td>
                          <td className="py-1.5 pr-4">{g.name}</td>
                          <td className="py-1.5 pr-4 text-muted-foreground">{g.company ?? "—"}</td>
                          <td className="py-1.5 font-mono text-xs">
                            {g.tableId ? `${tableLabel[g.tableId]} · ${g.seatIndex}` : "Unassigned"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </section>
          );
        })()}



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
                      {t.notes && <p className="text-xs text-muted-foreground italic mt-0.5 mb-2">{t.notes}</p>}
                    </div>
                    <table className="w-full">
                      <tbody>
                        {Array.from({ length: t.seats }, (_, i) => i + 1).map((seat) => {
                          const g = list.find((x) => x.seatIndex === seat);
                          const isTbc = g?.isPlaceholder === true;
                          return (
                            <tr key={seat} className={`border-t border-border/60 ${isTbc ? "opacity-50 italic" : ""}`}>
                              <td className="w-12 p-2 font-mono text-muted-foreground">{seat}</td>
                              <td className="p-2 font-medium">{g ? (isTbc ? "TBC" : g.name) : <span className="text-muted-foreground italic">—</span>}</td>
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
              <h2 className="font-display text-3xl mb-4 no-print">Tent cards (fold along dashed line)</h2>
              <div className="grid grid-cols-2 gap-3">
                {eligibleGuests.map((g) => {
                  const tbl = tables.find((t) => t.id === g.tableId);
                  return (
                    <div
                      key={g.id}
                      style={{ width: "105mm", height: "74mm", breakInside: "avoid", pageBreakInside: "avoid" }}
                      className="border border-gray-300 relative flex flex-col bg-white text-black"
                    >
                      <div
                        className="flex items-center justify-center border-b border-dashed border-gray-400"
                        style={{ height: "35mm", transform: "rotate(180deg)" }}
                      >
                        <span className="font-display text-3xl font-bold text-center px-3">{g.name}</span>
                      </div>
                      <div className="flex flex-col items-center justify-center flex-1 gap-0.5 px-3 py-2">
                        <span className="font-display text-xl font-bold text-center leading-tight">{g.name}</span>
                        {g.company && <span className="text-xs text-gray-500 text-center">{g.company}</span>}
                        {g.title && <span className="text-[10px] text-gray-400 text-center">{g.title}</span>}
                        <div className="flex items-center gap-2 mt-1">
                          {tbl && (
                            <span className="text-[10px] font-mono bg-gray-100 px-1.5 py-0.5 rounded">
                              Table {tbl.label} · Seat {g.seatIndex}
                            </span>
                          )}
                          {g.meal !== "None" && (
                            <span className="text-[10px] text-gray-400">
                              {MEAL_ICON[g.meal] ?? ""} {g.meal}{g.dietary ? ` · ${g.dietary}` : ""}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

          </>
        )}
      </div>
    </div>
  );
}

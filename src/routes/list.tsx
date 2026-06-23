import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { usePlanStore, sortKey, type RsvpStatus, type Tag } from "@/lib/plan-store";
import { useMemo, useState } from "react";
import { exportFilteredList } from "@/lib/import-export";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Download, ListFilter } from "lucide-react";

export const Route = createFileRoute("/list")({
  ssr: false,
  head: () => ({ meta: [{ title: "Lists · Seatcraft" }] }),
  component: ListPage,
});

const TAGS: Tag[] = ["VIP", "Wheelchair", "Child", "Speaker", "Sponsor"];
const RSVPS: ("All" | RsvpStatus)[] = ["All", "Confirmed", "Pending", "Declined", "Waitlist", "No-show"];

type SortBy = "lastName" | "name" | "company" | "table" | "cohort" | "meal";

function ListPage() {
  const guests = usePlanStore((s) => s.guests);
  const tables = usePlanStore((s) => s.tables);
  const tableLabel = useMemo(() => Object.fromEntries(tables.map((t) => [t.id, t.label])), [tables]);

  const [query, setQuery] = useState("");
  const [tag, setTag] = useState<Tag | "All">("All");
  const [rsvp, setRsvp] = useState<"All" | RsvpStatus>("All");
  const [cohort, setCohort] = useState<string>("All");
  const [tableFilter, setTableFilter] = useState<string>("All");
  const [sortBy, setSortBy] = useState<SortBy>("lastName");

  const cohorts = useMemo(() => {
    const s = new Set<string>();
    guests.forEach((g) => g.cohort && s.add(g.cohort));
    return ["All", ...[...s].sort()];
  }, [guests]);

  const filtered = useMemo(() => {
    let list = guests.slice();
    if (query.trim()) {
      const q = query.toLowerCase();
      list = list.filter(
        (g) => g.name.toLowerCase().includes(q) || (g.company ?? "").toLowerCase().includes(q),
      );
    }
    if (tag !== "All") list = list.filter((g) => g.tags.includes(tag));
    if (rsvp !== "All") list = list.filter((g) => g.rsvpStatus === rsvp);
    if (cohort !== "All") list = list.filter((g) => g.cohort === cohort);
    if (tableFilter !== "All") {
      if (tableFilter === "__unassigned__") list = list.filter((g) => !g.tableId);
      else list = list.filter((g) => g.tableId === tableFilter);
    }
    list.sort((a, b) => {
      switch (sortBy) {
        case "lastName":
          return sortKey(a).localeCompare(sortKey(b));
        case "name":
          return a.name.localeCompare(b.name);
        case "company":
          return (a.company ?? "").localeCompare(b.company ?? "");
        case "cohort":
          return (a.cohort ?? "").localeCompare(b.cohort ?? "");
        case "meal":
          return a.meal.localeCompare(b.meal);
        case "table":
          return (tableLabel[a.tableId ?? ""] ?? "ZZZ").localeCompare(tableLabel[b.tableId ?? ""] ?? "ZZZ");
      }
    });
    return list;
  }, [guests, query, tag, rsvp, cohort, tableFilter, sortBy, tableLabel]);

  function doExport(format: "csv" | "xlsx") {
    const name = `seatcraft-${tag !== "All" ? tag.toLowerCase() : "list"}-${Date.now()}`;
    exportFilteredList(filtered, tables, format, name);
  }

  return (
    <AppShell>
      <div className="max-w-[1400px] mx-auto px-6 py-8">
        <div className="flex items-end justify-between flex-wrap gap-4 mb-6 pb-6 border-b border-border/60">
          <div>
            <h1 className="font-display text-4xl flex items-center gap-3">
              <ListFilter className="h-7 w-7" /> Lists
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Filter, sort and export any slice of your guest list.
            </p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => doExport("csv")} className="h-10 px-3 rounded-md border border-input text-sm inline-flex items-center gap-1.5 hover:bg-accent">
              <Download className="h-4 w-4" /> CSV
            </button>
            <button onClick={() => doExport("xlsx")} className="h-10 px-3 rounded-md bg-primary text-primary-foreground text-sm inline-flex items-center gap-1.5">
              <Download className="h-4 w-4" /> Excel
            </button>
          </div>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-6 gap-3 mb-4">
          <Input placeholder="Search…" value={query} onChange={(e) => setQuery(e.target.value)} className="lg:col-span-2" />
          <Select value={tag} onValueChange={(v) => setTag(v as Tag | "All")}>
            <SelectTrigger><SelectValue placeholder="Tag" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="All">All tags</SelectItem>
              {TAGS.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={rsvp} onValueChange={(v) => setRsvp(v as any)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {RSVPS.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={cohort} onValueChange={setCohort}>
            <SelectTrigger><SelectValue placeholder="Cohort" /></SelectTrigger>
            <SelectContent>
              {cohorts.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={tableFilter} onValueChange={setTableFilter}>
            <SelectTrigger><SelectValue placeholder="Table" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="All">All tables</SelectItem>
              <SelectItem value="__unassigned__">Unassigned</SelectItem>
              {tables.map((t) => <SelectItem key={t.id} value={t.id}>Table {t.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center justify-between mb-3">
          <p className="text-sm text-muted-foreground">{filtered.length} guest{filtered.length === 1 ? "" : "s"}</p>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Sort by</span>
            <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortBy)}>
              <SelectTrigger className="w-40 h-8"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="lastName">Last name</SelectItem>
                <SelectItem value="name">Full name</SelectItem>
                <SelectItem value="company">Company</SelectItem>
                <SelectItem value="cohort">Cohort</SelectItem>
                <SelectItem value="table">Table</SelectItem>
                <SelectItem value="meal">Meal</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="border border-border rounded-xl bg-card overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="text-left p-3">Last</th>
                <th className="text-left p-3">First</th>
                <th className="text-left p-3">Company</th>
                <th className="text-left p-3">Cohort</th>
                <th className="text-left p-3">Tags</th>
                <th className="text-left p-3">Meal</th>
                <th className="text-left p-3">RSVP</th>
                <th className="text-left p-3">Table · Seat</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((g) => (
                <tr key={g.id} className="border-t border-border/60 hover:bg-muted/30">
                  <td className="p-3 font-medium">{g.lastName ?? g.name.split(" ").slice(-1)[0]}</td>
                  <td className="p-3">{g.firstName ?? g.name.split(" ").slice(0, -1).join(" ") || g.name}</td>
                  <td className="p-3 text-muted-foreground">{g.company ?? "—"}</td>
                  <td className="p-3 text-muted-foreground">{g.cohort ?? "—"}</td>
                  <td className="p-3"><span className="text-xs">{g.tags.join(", ") || "—"}</span></td>
                  <td className="p-3">{g.meal}</td>
                  <td className="p-3 text-xs">{g.rsvpStatus}</td>
                  <td className="p-3 font-mono text-xs">
                    {g.tableId ? `${tableLabel[g.tableId]} · ${g.seatIndex}` : <span className="text-muted-foreground">—</span>}
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={8} className="p-8 text-center text-muted-foreground">No guests match these filters.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </AppShell>
  );
}

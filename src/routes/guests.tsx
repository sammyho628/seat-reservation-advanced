import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { usePlanStore, type Guest, type Meal, type Tag } from "@/lib/plan-store";
import { parseFile, exportGuestsCSV, exportGuestsXLSX } from "@/lib/import-export";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Upload, Download, Plus, Trash2, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/guests")({ssr: false, ...{
  head: () => ({
    meta: [{ title: "Guests · Seatcraft" }],
  }),
  component: GuestsPage,
});

const MEALS: Meal[] = ["None", "Chicken", "Fish", "Vegetarian", "Vegan", "Kids"];
const TAGS: Tag[] = ["VIP", "Wheelchair", "Child", "Speaker", "Sponsor"];

function GuestsPage() {
  const guests = usePlanStore((s) => s.guests);
  const tables = usePlanStore((s) => s.tables);
  const addGuests = usePlanStore((s) => s.addGuests);
  const updateGuest = usePlanStore((s) => s.updateGuest);
  const removeGuest = usePlanStore((s) => s.removeGuest);
  const clearGuests = usePlanStore((s) => s.clearGuests);

  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "assigned" | "unassigned">("all");

  const tableLabel = useMemo(
    () => Object.fromEntries(tables.map((t) => [t.id, t.label])),
    [tables],
  );

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    try {
      const drafts = await parseFile(f);
      if (drafts.length === 0) {
        toast.error("No rows recognized. Need at least a 'Name' column.");
        return;
      }
      addGuests(drafts);
      toast.success(`Imported ${drafts.length} guests`);
    } catch (err) {
      toast.error("Could not parse file");
      console.error(err);
    } finally {
      e.target.value = "";
    }
  }

  const filtered = guests.filter((g) => {
    if (filter === "assigned" && !g.tableId) return false;
    if (filter === "unassigned" && g.tableId) return false;
    if (!query) return true;
    const q = query.toLowerCase();
    return (
      g.name.toLowerCase().includes(q) ||
      (g.company ?? "").toLowerCase().includes(q) ||
      (g.group ?? "").toLowerCase().includes(q)
    );
  });

  function addBlank() {
    addGuests([{ name: "New guest", meal: "None", tags: [] }]);
  }

  function toggleTag(g: Guest, tag: Tag) {
    const has = g.tags.includes(tag);
    updateGuest(g.id, { tags: has ? g.tags.filter((t) => t !== tag) : [...g.tags, tag] });
  }

  const mealCounts = useMemo(() => {
    const m: Record<string, number> = {};
    guests.forEach((g) => {
      m[g.meal] = (m[g.meal] || 0) + 1;
    });
    return m;
  }, [guests]);

  return (
    <AppShell>
      <div className="max-w-[1400px] mx-auto px-6 py-8">
        <div className="flex items-end justify-between mb-6 pb-6 border-b border-border/60 flex-wrap gap-4">
          <div>
            <h1 className="font-display text-4xl">Guests</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {guests.length} total · {guests.filter((g) => g.tableId).length} seated · {guests.filter((g) => !g.tableId).length} unassigned
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <label className="h-10 px-3 rounded-md border border-input text-sm inline-flex items-center gap-1.5 cursor-pointer hover:bg-accent">
              <Upload className="h-4 w-4" /> Import CSV/Excel
              <input
                type="file"
                accept=".csv,.xlsx,.xls"
                onChange={handleFile}
                className="hidden"
              />
            </label>
            <button
              onClick={() => exportGuestsCSV(guests, tableLabel)}
              className="h-10 px-3 rounded-md border border-input text-sm inline-flex items-center gap-1.5 hover:bg-accent"
            >
              <Download className="h-4 w-4" /> CSV
            </button>
            <button
              onClick={() => exportGuestsXLSX(guests, tableLabel)}
              className="h-10 px-3 rounded-md border border-input text-sm inline-flex items-center gap-1.5 hover:bg-accent"
            >
              <Download className="h-4 w-4" /> Excel
            </button>
            <button
              onClick={addBlank}
              className="h-10 px-3 rounded-md bg-primary text-primary-foreground text-sm inline-flex items-center gap-1.5"
            >
              <Plus className="h-4 w-4" /> Add guest
            </button>
          </div>
        </div>

        {/* meal summary chips */}
        {guests.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-4">
            {Object.entries(mealCounts).map(([meal, count]) => (
              <span key={meal} className="text-xs px-2 py-1 rounded-full bg-muted text-muted-foreground font-mono">
                {meal}: {count}
              </span>
            ))}
          </div>
        )}

        <div className="flex items-center gap-2 mb-4">
          <div className="relative flex-1 max-w-md">
            <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search by name, company, group…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={filter} onValueChange={(v) => setFilter(v as typeof filter)}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="assigned">Seated</SelectItem>
              <SelectItem value="unassigned">Unassigned</SelectItem>
            </SelectContent>
          </Select>
          {guests.length > 0 && (
            <button
              onClick={() => {
                if (confirm("Remove all guests? This cannot be undone.")) clearGuests();
              }}
              className="h-10 px-3 rounded-md text-sm text-destructive hover:bg-destructive/10"
            >
              Clear all
            </button>
          )}
        </div>

        {filtered.length === 0 ? (
          <div className="border border-dashed border-border rounded-xl py-16 text-center">
            <p className="text-muted-foreground mb-3">No guests yet.</p>
            <p className="text-xs text-muted-foreground">
              Import a CSV/Excel with at least a <span className="font-mono">Name</span> column. Optional columns: Company, Title, Meal, Tags, Group, Dietary, Notes.
            </p>
          </div>
        ) : (
          <div className="border border-border rounded-xl overflow-hidden bg-card">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="text-left p-3">Name</th>
                  <th className="text-left p-3">Company</th>
                  <th className="text-left p-3">Group</th>
                  <th className="text-left p-3">Meal</th>
                  <th className="text-left p-3">Tags</th>
                  <th className="text-left p-3">Table</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((g) => (
                  <tr key={g.id} className="border-t border-border/60 hover:bg-muted/30">
                    <td className="p-2">
                      <input
                        value={g.name}
                        onChange={(e) => updateGuest(g.id, { name: e.target.value })}
                        className="w-full bg-transparent px-1 py-1 rounded focus:bg-background focus:ring-1 focus:ring-ring focus:outline-none"
                      />
                    </td>
                    <td className="p-2">
                      <input
                        value={g.company ?? ""}
                        onChange={(e) => updateGuest(g.id, { company: e.target.value })}
                        className="w-full bg-transparent px-1 py-1 rounded focus:bg-background focus:ring-1 focus:ring-ring focus:outline-none"
                      />
                    </td>
                    <td className="p-2">
                      <input
                        value={g.group ?? ""}
                        onChange={(e) => updateGuest(g.id, { group: e.target.value })}
                        placeholder="—"
                        className="w-full bg-transparent px-1 py-1 rounded focus:bg-background focus:ring-1 focus:ring-ring focus:outline-none"
                      />
                    </td>
                    <td className="p-2">
                      <select
                        value={g.meal}
                        onChange={(e) => updateGuest(g.id, { meal: e.target.value as Meal })}
                        className="bg-transparent px-1 py-1 rounded focus:bg-background focus:ring-1 focus:ring-ring focus:outline-none"
                      >
                        {MEALS.map((m) => (
                          <option key={m} value={m}>
                            {m}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="p-2">
                      <div className="flex gap-1 flex-wrap">
                        {TAGS.map((t) => {
                          const on = g.tags.includes(t);
                          return (
                            <button
                              key={t}
                              onClick={() => toggleTag(g, t)}
                              className={`text-[10px] px-1.5 py-0.5 rounded-full border transition ${
                                on
                                  ? "bg-primary text-primary-foreground border-primary"
                                  : "border-border text-muted-foreground hover:border-foreground/40"
                              }`}
                            >
                              {t}
                            </button>
                          );
                        })}
                      </div>
                    </td>
                    <td className="p-2 font-mono text-xs">
                      {g.tableId ? (
                        <span>
                          {tableLabel[g.tableId]} · {g.seatIndex}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="p-2 text-right">
                      <button
                        onClick={() => removeGuest(g.id)}
                        className="text-muted-foreground hover:text-destructive p-1"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AppShell>
  );
}

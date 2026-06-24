import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { usePlanStore, type Guest, type Meal, type RsvpStatus, type Tag } from "@/lib/plan-store";
import {
  parseFileRows,
  detectColumnMap,
  rowsToGuestsWithMap,
  exportGuestsCSV,
  exportGuestsXLSX,
  reconcileGuests,
  type ReconciliationDiff,
  type GuestDraft,
} from "@/lib/import-export";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Upload, Download, Plus, Trash2, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Select, SelectTrigger, SelectContent, SelectItem, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/guests")({
  ssr: false,
  head: () => ({ meta: [{ title: "Guests · Seatcraft" }] }),
  component: GuestsPage,
});

const MEALS: Meal[] = ["None", "Chicken", "Fish", "Vegetarian", "Vegan", "Kids"];
const TAGS: Tag[] = ["VIP", "Wheelchair", "Child", "Speaker", "Sponsor"];
const RSVPS: RsvpStatus[] = ["Confirmed", "Pending", "Declined", "Waitlist", "No-show"];

const RSVP_COLOR: Record<RsvpStatus, string> = {
  Confirmed: "bg-[color:var(--color-rsvp-confirmed)]/15 text-[color:var(--color-rsvp-confirmed)]",
  Pending: "bg-[color:var(--color-rsvp-pending)]/15 text-[color:var(--color-rsvp-pending)]",
  Declined: "bg-[color:var(--color-rsvp-declined)]/15 text-[color:var(--color-rsvp-declined)]",
  Waitlist: "bg-muted text-muted-foreground",
  "No-show": "bg-muted text-muted-foreground line-through",
};

const FIELDS = ["name", "firstName", "lastName", "company", "title", "cohort", "meal", "tags", "dietary", "notes", "rsvpStatus"];

function GuestsPage() {
  const guests = usePlanStore((s) => s.guests);
  const tables = usePlanStore((s) => s.tables);
  const addGuests = usePlanStore((s) => s.addGuests);
  const updateGuest = usePlanStore((s) => s.updateGuest);
  const removeGuest = usePlanStore((s) => s.removeGuest);
  const clearGuests = usePlanStore((s) => s.clearGuests);
  const assignGuest = usePlanStore((s) => s.assignGuest);
  const unassignGuest = usePlanStore((s) => s.unassignGuest);

  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "assigned" | "unassigned">("all");
  const [cohortFilter, setCohortFilter] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [lastChecked, setLastChecked] = useState<string | null>(null);
  const [clearOpen, setClearOpen] = useState(false);

  // import state
  const [importRows, setImportRows] = useState<Record<string, unknown>[]>([]);
  const [importHeaders, setImportHeaders] = useState<string[]>([]);
  const [columnMap, setColumnMap] = useState<Record<string, string | undefined>>({});
  const [mappingOpen, setMappingOpen] = useState(false);
  const [reconcileOpen, setReconcileOpen] = useState(false);
  const [diff, setDiff] = useState<ReconciliationDiff | null>(null);
  const [pendingDrafts, setPendingDrafts] = useState<GuestDraft[]>([]);

  const tableLabel = useMemo(
    () => Object.fromEntries(tables.map((t) => [t.id, t.label])),
    [tables],
  );

  const cohortCounts = useMemo(() => {
    const m: Record<string, number> = {};
    guests.forEach((g) => { if (g.cohort) m[g.cohort] = (m[g.cohort] || 0) + 1; });
    return m;
  }, [guests]);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    try {
      const { rows, headers } = await parseFileRows(f);
      if (rows.length === 0) {
        toast.error("File is empty");
        return;
      }
      setImportRows(rows);
      setImportHeaders(headers);
      setColumnMap(detectColumnMap(headers));
      setMappingOpen(true);
    } catch (err) {
      toast.error("Could not parse file");
      console.error(err);
    } finally {
      e.target.value = "";
    }
  }

  function confirmMapping() {
    const drafts = rowsToGuestsWithMap(importRows, columnMap);
    if (drafts.length === 0) {
      toast.error("No rows with a 'Name' column.");
      return;
    }
    // duplicate check inside incoming
    const seen = new Set<string>();
    let dupes = 0;
    drafts.forEach((d) => {
      const k = d.name.toLowerCase().trim();
      if (seen.has(k)) dupes++;
      seen.add(k);
    });
    if (dupes > 0) toast.warning(`${dupes} duplicate name(s) in the file.`);
    setMappingOpen(false);
    if (guests.length === 0) {
      addGuests(drafts);
      toast.success(`Imported ${drafts.length} guests`);
      return;
    }
    setDiff(reconcileGuests(guests, drafts));
    setPendingDrafts(drafts);
    setReconcileOpen(true);
  }

  function applyReconciliation(opts: { removeMissing: boolean; acceptChanges: boolean }) {
    if (!diff) return;
    if (diff.added.length) addGuests(diff.added);
    if (opts.acceptChanges) {
      diff.changed.forEach(({ existing, incoming }) => {
        const { name: _n, ...patch } = incoming;
        updateGuest(existing.id, patch);
      });
    }
    if (opts.removeMissing) {
      diff.removed.forEach((g) => removeGuest(g.id));
    }
    setReconcileOpen(false);
    setDiff(null);
    setPendingDrafts([]);
    toast.success("Reconciled imported list");
  }

  const filtered = guests.filter((g) => {
    if (filter === "assigned" && !g.tableId) return false;
    if (filter === "unassigned" && g.tableId) return false;
    if (cohortFilter && g.cohort !== cohortFilter) return false;
    if (!query) return true;
    const q = query.toLowerCase();
    return (
      g.name.toLowerCase().includes(q) ||
      (g.company ?? "").toLowerCase().includes(q) ||
      (g.cohort ?? "").toLowerCase().includes(q)
    );
  });

  function addBlank() {
    addGuests([{ name: "New guest", meal: "None", tags: [], rsvpStatus: "Confirmed" }]);
  }

  function toggleTag(g: Guest, tag: Tag) {
    const has = g.tags.includes(tag);
    updateGuest(g.id, { tags: has ? g.tags.filter((t) => t !== tag) : [...g.tags, tag] });
  }

  function toggleSelect(id: string, shift: boolean) {
    const next = new Set(selected);
    if (shift && lastChecked) {
      const ids = filtered.map((g) => g.id);
      const a = ids.indexOf(lastChecked);
      const b = ids.indexOf(id);
      if (a >= 0 && b >= 0) {
        const [lo, hi] = a < b ? [a, b] : [b, a];
        for (let i = lo; i <= hi; i++) next.add(ids[i]);
      }
    } else {
      if (next.has(id)) next.delete(id); else next.add(id);
    }
    setSelected(next);
    setLastChecked(id);
  }

  function bulkAssign(tableId: string) {
    selected.forEach((id) => assignGuest(id, tableId));
    toast.success(`Assigned ${selected.size} to ${tableLabel[tableId]}`);
    setSelected(new Set());
  }
  function bulkRsvp(s: RsvpStatus) {
    selected.forEach((id) => updateGuest(id, { rsvpStatus: s }));
    setSelected(new Set());
  }
  function bulkMeal(m: Meal) {
    selected.forEach((id) => updateGuest(id, { meal: m }));
    setSelected(new Set());
  }
  function bulkCohort() {
    const c = prompt("Cohort name (blank to clear):") ?? "";
    selected.forEach((id) => updateGuest(id, { cohort: c.trim() || undefined }));
    setSelected(new Set());
  }
  function bulkDelete() {
    if (!confirm(`Delete ${selected.size} guests?`)) return;
    selected.forEach((id) => removeGuest(id));
    setSelected(new Set());
  }

  return (
    <AppShell>
      <div className="max-w-[1500px] mx-auto px-6 py-8">
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
              <input type="file" accept=".csv,.xlsx,.xls" onChange={handleFile} className="hidden" />
            </label>
            <button onClick={() => exportGuestsCSV(guests, tableLabel)} className="h-10 px-3 rounded-md border border-input text-sm inline-flex items-center gap-1.5 hover:bg-accent">
              <Download className="h-4 w-4" /> CSV
            </button>
            <button onClick={() => exportGuestsXLSX(guests, tableLabel)} className="h-10 px-3 rounded-md border border-input text-sm inline-flex items-center gap-1.5 hover:bg-accent">
              <Download className="h-4 w-4" /> Excel
            </button>
            <button onClick={addBlank} className="h-10 px-3 rounded-md bg-primary text-primary-foreground text-sm inline-flex items-center gap-1.5">
              <Plus className="h-4 w-4" /> Add guest
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2 mb-4 flex-wrap">
          <div className="relative flex-1 max-w-md">
            <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Search…" value={query} onChange={(e) => setQuery(e.target.value)} className="pl-9" />
          </div>
          <Select value={filter} onValueChange={(v) => setFilter(v as typeof filter)}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="assigned">Seated</SelectItem>
              <SelectItem value="unassigned">Unassigned</SelectItem>
            </SelectContent>
          </Select>
          {cohortFilter && (
            <button onClick={() => setCohortFilter(null)} className="text-xs px-2 py-1 rounded-full bg-accent">
              Cohort: {cohortFilter} ✕
            </button>
          )}
          {guests.length > 0 && (
            <button onClick={() => setClearOpen(true)} className="h-10 px-3 rounded-md text-sm text-destructive hover:bg-destructive/10 ml-auto">
              Clear all
            </button>
          )}
        </div>

        {filtered.length === 0 ? (
          <div className="border border-dashed border-border rounded-xl py-16 text-center">
            <p className="text-muted-foreground mb-3">No guests yet.</p>
            <p className="text-xs text-muted-foreground">
              Import a CSV/Excel with at least a <span className="font-mono">Name</span> column.
            </p>
          </div>
        ) : (
          <div className="border border-border rounded-xl overflow-x-auto bg-card">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="p-2 w-8"></th>
                  <th className="text-left p-3">Name (combined)</th>
                  <th className="text-left p-3">First</th>
                  <th className="text-left p-3">Last</th>
                  <th className="text-left p-3">Company</th>
                  <th className="text-left p-3">Title</th>
                  <th className="text-left p-3">Cohort</th>
                  <th className="text-left p-3">Meal</th>
                  <th className="text-left p-3">Dietary</th>
                  <th className="text-left p-3">RSVP</th>
                  <th className="text-left p-3">Tags</th>
                  <th className="text-left p-3">Table</th>
                  <th className="text-center p-3">Lock</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((g) => (
                  <tr key={g.id} className="border-t border-border/60 hover:bg-muted/30">
                    <td className="p-2 text-center">
                      <input
                        type="checkbox"
                        checked={selected.has(g.id)}
                        onChange={(e) => toggleSelect(g.id, (e.nativeEvent as MouseEvent).shiftKey)}
                      />
                    </td>
                    <td className="p-2">
                      <input
                        value={g.name}
                        onChange={(e) => updateGuest(g.id, { name: e.target.value })}
                        className="w-full bg-transparent px-1 py-1 rounded focus:bg-background focus:ring-1 focus:ring-ring focus:outline-none"
                      />
                    </td>
                    <td className="p-2">
                      <input
                        value={g.firstName ?? ""}
                        onChange={(e) => updateGuest(g.id, { firstName: e.target.value || undefined })}
                        placeholder="—"
                        className="w-full bg-transparent px-1 py-1 rounded focus:bg-background focus:ring-1 focus:ring-ring focus:outline-none"
                      />
                    </td>
                    <td className="p-2">
                      <input
                        value={g.lastName ?? ""}
                        onChange={(e) => updateGuest(g.id, { lastName: e.target.value || undefined })}
                        placeholder="—"
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
                        value={g.title ?? ""}
                        onChange={(e) => updateGuest(g.id, { title: e.target.value })}
                        className="w-full bg-transparent px-1 py-1 rounded focus:bg-background focus:ring-1 focus:ring-ring focus:outline-none"
                      />
                    </td>
                    <td className="p-2">
                      <div className="flex items-center gap-1">
                        <input
                          value={g.cohort ?? ""}
                          onChange={(e) => updateGuest(g.id, { cohort: e.target.value || undefined })}
                          placeholder="—"
                          className="flex-1 bg-transparent px-1 py-1 rounded focus:bg-background focus:ring-1 focus:ring-ring focus:outline-none"
                        />
                        {g.cohort && cohortCounts[g.cohort] > 1 && (
                          <button
                            onClick={() => setCohortFilter(g.cohort!)}
                            className="text-[10px] font-mono px-1 rounded bg-accent text-accent-foreground"
                            title="Filter to this cohort"
                          >
                            {cohortCounts[g.cohort]}
                          </button>
                        )}
                      </div>
                    </td>
                    <td className="p-2">
                      <select
                        value={g.meal}
                        onChange={(e) => updateGuest(g.id, { meal: e.target.value as Meal })}
                        className="bg-transparent px-1 py-1 rounded focus:bg-background focus:ring-1 focus:ring-ring focus:outline-none"
                      >
                        {MEALS.map((m) => <option key={m} value={m}>{m}</option>)}
                      </select>
                    </td>
                    <td className={`p-2 ${g.dietary ? "bg-[color:var(--color-dietary-alert)]/10" : ""}`}>
                      <input
                        value={g.dietary ?? ""}
                        onChange={(e) => updateGuest(g.id, { dietary: e.target.value || undefined })}
                        placeholder="—"
                        className="w-full bg-transparent px-1 py-1 rounded focus:bg-background focus:ring-1 focus:ring-ring focus:outline-none"
                      />
                    </td>
                    <td className="p-2">
                      <select
                        value={g.rsvpStatus}
                        onChange={(e) => updateGuest(g.id, { rsvpStatus: e.target.value as RsvpStatus })}
                        className={`text-xs px-2 py-1 rounded-md border-0 ${RSVP_COLOR[g.rsvpStatus]}`}
                      >
                        {RSVPS.map((s) => <option key={s} value={s}>{s}</option>)}
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
                                on ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:border-foreground/40"
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
                        <button onClick={() => unassignGuest(g.id)} className="hover:underline">
                          {tableLabel[g.tableId]} · {g.seatIndex}
                        </button>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="p-2 text-center">
                      <button
                        onClick={() => updateGuest(g.id, { locked: !g.locked })}
                        disabled={!g.tableId}
                        title={g.locked ? "Unlock seat" : g.tableId ? "Lock to current seat" : "Assign to a seat first"}
                        className={`text-sm ${g.locked ? "text-amber-500" : "text-muted-foreground/40 hover:text-muted-foreground"} disabled:opacity-30`}
                      >
                        {g.locked ? "🔒" : "○"}
                      </button>
                    </td>
                    <td className="p-2 text-right">
                      <button onClick={() => removeGuest(g.id)} className="text-muted-foreground hover:text-destructive p-1">
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

      {/* Bulk action bar */}
      {selected.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 bg-card border border-border rounded-xl shadow-lg px-4 py-2 flex items-center gap-2">
          <span className="text-sm font-medium">{selected.size} selected</span>
          <Select onValueChange={(v) => bulkAssign(v)}>
            <SelectTrigger className="h-8 w-36"><SelectValue placeholder="Assign to table" /></SelectTrigger>
            <SelectContent>
              {tables.map((t) => <SelectItem key={t.id} value={t.id}>Table {t.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select onValueChange={(v) => bulkRsvp(v as RsvpStatus)}>
            <SelectTrigger className="h-8 w-32"><SelectValue placeholder="RSVP" /></SelectTrigger>
            <SelectContent>{RSVPS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
          </Select>
          <Select onValueChange={(v) => bulkMeal(v as Meal)}>
            <SelectTrigger className="h-8 w-28"><SelectValue placeholder="Meal" /></SelectTrigger>
            <SelectContent>{MEALS.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
          </Select>
          <button onClick={bulkCohort} className="h-8 px-3 rounded-md border border-input text-xs">Set cohort</button>
          <button onClick={bulkDelete} className="h-8 px-3 rounded-md text-destructive text-xs hover:bg-destructive/10">Delete</button>
          <button onClick={() => setSelected(new Set())} className="text-xs text-muted-foreground ml-1">Clear</button>
        </div>
      )}

      {/* Mapping dialog */}
      <Dialog open={mappingOpen} onOpenChange={setMappingOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Map columns</DialogTitle></DialogHeader>
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {FIELDS.map((field) => (
              <div key={field} className="flex items-center gap-3">
                <span className="text-sm font-mono w-28 text-muted-foreground">{field}</span>
                <Select
                  value={columnMap[field] ?? "__none__"}
                  onValueChange={(v) =>
                    setColumnMap((m) => ({ ...m, [field]: v === "__none__" ? undefined : v }))
                  }
                >
                  <SelectTrigger className="flex-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">— unmapped —</SelectItem>
                    {importHeaders.map((h) => <SelectItem key={h} value={h}>{h}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            ))}
          </div>
          <div className="text-xs text-muted-foreground border-t border-border pt-2">
            <div className="font-semibold mb-1">Preview (first 3 rows):</div>
            {importRows.slice(0, 3).map((r, i) => (
              <div key={i} className="font-mono truncate">
                {(columnMap.name && String(r[columnMap.name])) || "—"}
                {columnMap.company ? ` · ${r[columnMap.company]}` : ""}
                {columnMap.meal ? ` · ${r[columnMap.meal]}` : ""}
              </div>
            ))}
          </div>
          <DialogFooter>
            <button onClick={() => setMappingOpen(false)} className="h-9 px-3 rounded-md border border-input text-sm">Cancel</button>
            <button onClick={confirmMapping} className="h-9 px-4 rounded-md bg-primary text-primary-foreground text-sm">Continue</button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reconciliation dialog */}
      <Dialog open={reconcileOpen} onOpenChange={setReconcileOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Reconcile imported list</DialogTitle></DialogHeader>
          {diff && (
            <div className="space-y-4 max-h-96 overflow-y-auto text-sm">
              <div>
                <div className="font-semibold text-[color:var(--color-rsvp-confirmed)] mb-1">
                  + {diff.added.length} new
                </div>
                {diff.added.slice(0, 12).map((g, i) => <div key={i} className="text-xs text-muted-foreground">{g.name}</div>)}
                {diff.added.length > 12 && <div className="text-xs text-muted-foreground">…and {diff.added.length - 12} more</div>}
              </div>
              <div>
                <div className="font-semibold text-destructive mb-1">− {diff.removed.length} no longer in file</div>
                {diff.removed.slice(0, 12).map((g) => <div key={g.id} className="text-xs text-muted-foreground">{g.name}</div>)}
              </div>
              <div>
                <div className="font-semibold text-[color:var(--color-dietary-alert)] mb-1">
                  ~ {diff.changed.length} changed
                </div>
                {diff.changed.slice(0, 12).map((c, i) => (
                  <div key={i} className="text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">{c.existing.name}</span> — {c.diffs.join(", ")}
                  </div>
                ))}
              </div>
              <div className="text-xs text-muted-foreground">{diff.unchanged} unchanged. Seat assignments preserved.</div>
            </div>
          )}
          <DialogFooter className="gap-2 flex-wrap">
            <button onClick={() => setReconcileOpen(false)} className="h-9 px-3 rounded-md border border-input text-sm">Cancel</button>
            <button
              onClick={() => applyReconciliation({ removeMissing: false, acceptChanges: true })}
              className="h-9 px-3 rounded-md border border-input text-sm"
            >
              Apply changes (keep missing)
            </button>
            <button
              onClick={() => applyReconciliation({ removeMissing: true, acceptChanges: true })}
              className="h-9 px-4 rounded-md bg-primary text-primary-foreground text-sm"
            >
              Apply + remove missing
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={clearOpen} onOpenChange={setClearOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove all guests?</AlertDialogTitle>
            <AlertDialogDescription>This will delete every guest from the plan. It cannot be undone except via Undo (⌘Z).</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={clearGuests} className="bg-destructive hover:bg-destructive/90">Remove all</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppShell>
  );
}

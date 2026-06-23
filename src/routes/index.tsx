import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { PlannerGrid } from "@/components/PlannerGrid";
import { UnassignedPanel } from "@/components/UnassignedPanel";
import { WelcomeGate } from "@/components/WelcomeGate";
import {
  usePlanStore,
  useTemporalStore,
  NAMING_VOCAB,
  type NamingScheme,
} from "@/lib/plan-store";
import { toast } from "sonner";
import {
  Wand2, RotateCcw, Settings as SettingsIcon, Undo2, Redo2, Camera,
  Search, BarChart2, ChevronUp, ChevronDown,
} from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select, SelectTrigger, SelectContent, SelectItem, SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Planner · Seatcraft" },
      { name: "description", content: "Visual ballroom seating planner with auto-seating, guest import, and print-ready layouts." },
    ],
  }),
  component: PlannerPage,
});

const SCHEME_LABELS: { value: NamingScheme; label: string }[] = [
  { value: "alpha", label: "A, B, C…" },
  { value: "numeric", label: "1, 2, 3…" },
  { value: "numeric-skip13", label: "1, 2… (skip 13)" },
  { value: "numeric-skip4", label: "Skip 4, 14, 24…" },
  { value: "numeric-skip-both", label: "Skip 13 + 4-series" },
  { value: "flowers", label: "🌸 Flowers" },
  { value: "colors", label: "🎨 Colours" },
  { value: "llm-models", label: "🤖 AI Models" },
  { value: "wines", label: "🍷 Wines" },
  { value: "cities", label: "🌍 Cities" },
  { value: "constellations", label: "✨ Constellations" },
];

function PlannerPage() {
  const [selectedGuestId, setSelectedGuestId] = useState<string | null>(null);
  const settings = usePlanStore((s) => s.settings);
  const setSettings = usePlanStore((s) => s.setSettings);
  const applyNamingScheme = usePlanStore((s) => s.applyNamingScheme);
  const autoSeat = usePlanStore((s) => s.autoSeat);
  const resetAssignments = usePlanStore((s) => s.resetAssignments);
  const guests = usePlanStore((s) => s.guests);
  const tables = usePlanStore((s) => s.tables);

  const pastStates = useTemporalStore((s) => s.pastStates) as any[];
  const futureStates = useTemporalStore((s) => s.futureStates) as any[];

  const [violatingGuestIds, setViolatingGuestIds] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [highlightedTableId, setHighlightedTableId] = useState<string | null>(null);
  const [analyticsOpen, setAnalyticsOpen] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  // keyboard shortcuts
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const meta = e.metaKey || e.ctrlKey;
      if (meta && e.key.toLowerCase() === "z" && !e.shiftKey) {
        e.preventDefault();
        (usePlanStore.temporal as any).getState().undo();
      } else if (meta && (e.key.toLowerCase() === "y" || (e.key.toLowerCase() === "z" && e.shiftKey))) {
        e.preventDefault();
        (usePlanStore.temporal as any).getState().redo();
      } else if (meta && e.key.toLowerCase() === "f") {
        e.preventDefault();
        searchRef.current?.focus();
      } else if (e.key === "Escape") {
        setSelectedGuestId(null);
        setSearch("");
        setHighlightedTableId(null);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  function handleAuto() {
    if (guests.length === 0) { toast.error("Add or import guests first."); return; }
    const r = autoSeat();
    setViolatingGuestIds(new Set(r.violatingGuestIds));
    toast.success(`Seated ${r.assigned} of ${guests.length}`, {
      description: r.violations
        ? `${r.violations} guest(s) violate rules.`
        : "No constraint violations.",
    });
  }

  async function exportPNG() {
    const node = document.getElementById("planner-grid-capture");
    if (!node) return;
    try {
      const mod = await import("html2canvas");
      const canvas = await mod.default(node, {
        backgroundColor: getComputedStyle(document.body).backgroundColor,
        scale: 2,
      });
      canvas.toBlob((blob) => {
        if (!blob) return;
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${settings.eventTitle.replace(/\s+/g, "-").toLowerCase()}-seating-map.png`;
        a.click();
        URL.revokeObjectURL(url);
      });
    } catch (e) {
      console.error(e);
      toast.error("PNG export failed");
    }
  }

  // search matching
  const matches = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return [];
    return guests
      .filter((g) =>
        g.name.toLowerCase().includes(q) || (g.company ?? "").toLowerCase().includes(q),
      )
      .slice(0, 8);
  }, [search, guests]);

  useEffect(() => {
    if (matches.length === 1 && matches[0].tableId) {
      setHighlightedTableId(matches[0].tableId);
      const t = setTimeout(() => setHighlightedTableId(null), 1500);
      return () => clearTimeout(t);
    }
  }, [matches]);

  // analytics
  const stats = useMemo(() => {
    const eligible = guests.filter((g) => g.rsvpStatus !== "Declined" && g.rsvpStatus !== "No-show");
    const capacity = tables.reduce((a, t) => a + t.seats, 0);
    const seated = eligible.filter((g) => g.tableId).length;
    const unassigned = eligible.length - seated;
    const meals: Record<string, number> = {};
    eligible.forEach((g) => { meals[g.meal] = (meals[g.meal] || 0) + 1; });
    const fullTables = tables.filter((t) => eligible.filter((g) => g.tableId === t.id).length >= t.seats).length;
    const companies: Record<string, number> = {};
    eligible.forEach((g) => { if (g.company) companies[g.company] = (companies[g.company] || 0) + 1; });
    const topCompanies = Object.entries(companies).sort((a, b) => b[1] - a[1]).slice(0, 3);
    const splitCohorts: string[] = [];
    const byCohort: Record<string, Set<string>> = {};
    eligible.forEach((g) => {
      if (g.cohort && g.tableId) {
        if (!byCohort[g.cohort]) byCohort[g.cohort] = new Set();
        byCohort[g.cohort].add(g.tableId);
      }
    });
    Object.entries(byCohort).forEach(([c, ts]) => { if (ts.size > 1) splitCohorts.push(c); });
    return { capacity, seated, unassigned, meals, fullTables, topCompanies, splitCohorts };
  }, [guests, tables]);

  const fillPct = stats.capacity ? Math.round((stats.seated / stats.capacity) * 100) : 0;

  const schemePreview = useMemo(() => {
    const vocab = NAMING_VOCAB[settings.namingScheme];
    if (vocab) return vocab.slice(0, 4).join(" · ");
    // generate first 4 labels using same helpers as store (simple inline)
    const labels: string[] = [];
    for (let i = 0; i < 4; i++) labels.push(tables[i]?.label ?? "—");
    return labels.join(" · ");
  }, [settings.namingScheme, tables]);

  function readLogo(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => setSettings({ logoDataUrl: String(reader.result) });
    reader.readAsDataURL(f);
  }

  return (
    <AppShell>
      <WelcomeGate />
      <div className="flex">
        <div className="flex-1 min-w-0">
          <div className="max-w-[1300px] mx-auto px-6 py-8">
            {/* Toolbar */}
            <div className="flex flex-wrap items-end gap-4 mb-6 pb-6 border-b border-border/60">
              <div className="flex-1 min-w-[260px]">
                <h1 className="font-display text-4xl">{settings.eventTitle}</h1>
                <p className="text-sm text-muted-foreground mt-1">
                  {tables.length} tables · {tables.reduce((a, t) => a + t.seats, 0)} seats
                </p>
              </div>

              <div className="flex items-end gap-3">
                <div>
                  <Label className="text-xs">Tables per row</Label>
                  <Input
                    className="w-32 font-mono mt-1"
                    defaultValue={settings.rowPattern}
                    onBlur={(e) => setSettings({ rowPattern: e.target.value })}
                  />
                </div>
                <div>
                  <Label className="text-xs">Default seats</Label>
                  <Input
                    type="number"
                    min={2}
                    max={20}
                    className="w-20 font-mono mt-1"
                    defaultValue={settings.defaultSeats}
                    onBlur={(e) => setSettings({ defaultSeats: parseInt(e.target.value) || 10 })}
                  />
                </div>

                <Dialog>
                  <DialogTrigger className="h-10 px-3 rounded-md border border-input hover:bg-accent inline-flex items-center gap-1.5 text-sm">
                    <SettingsIcon className="h-4 w-4" /> Event
                  </DialogTrigger>
                  <DialogContent className="max-w-md">
                    <DialogHeader><DialogTitle>Event settings</DialogTitle></DialogHeader>
                    <div className="space-y-4">
                      <div>
                        <Label>Event title</Label>
                        <Input value={settings.eventTitle} onChange={(e) => setSettings({ eventTitle: e.target.value })} />
                      </div>
                      <div className="flex items-center justify-between">
                        <Label>Show stage marker</Label>
                        <Switch checked={settings.showStage} onCheckedChange={(v) => setSettings({ showStage: v })} />
                      </div>
                      <div>
                        <Label>Table naming</Label>
                        <Select
                          value={settings.namingScheme}
                          onValueChange={(v) => applyNamingScheme(v as NamingScheme)}
                        >
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {SCHEME_LABELS.map((s) => (
                              <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <p className="text-[11px] font-mono text-muted-foreground mt-1">Preview: {schemePreview}</p>
                      </div>
                      <div>
                        <Label>Primary colour</Label>
                        <div className="flex items-center gap-2 mt-1">
                          <input
                            type="color"
                            value={settings.primaryColor}
                            onChange={(e) => setSettings({ primaryColor: e.target.value })}
                            className="h-9 w-12 rounded border border-input bg-transparent"
                          />
                          <Input
                            value={settings.primaryColor}
                            onChange={(e) => setSettings({ primaryColor: e.target.value })}
                            className="font-mono text-xs"
                          />
                        </div>
                      </div>
                      <div>
                        <Label>Event logo</Label>
                        <div className="flex items-center gap-3 mt-1">
                          {settings.logoDataUrl && (
                            <img src={settings.logoDataUrl} alt="" className="h-10 w-10 object-contain border border-border rounded" />
                          )}
                          <input type="file" accept="image/*" onChange={readLogo} className="text-xs" />
                          {settings.logoDataUrl && (
                            <button onClick={() => setSettings({ logoDataUrl: undefined })} className="text-xs text-destructive">
                              Remove
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => (usePlanStore.temporal as any).getState().undo()}
                  disabled={pastStates.length === 0}
                  title="Undo (⌘Z)"
                  className="h-10 w-10 rounded-md border border-input hover:bg-accent inline-flex items-center justify-center disabled:opacity-30"
                >
                  <Undo2 className="h-4 w-4" />
                </button>
                <button
                  onClick={() => (usePlanStore.temporal as any).getState().redo()}
                  disabled={futureStates.length === 0}
                  title="Redo (⌘⇧Z)"
                  className="h-10 w-10 rounded-md border border-input hover:bg-accent inline-flex items-center justify-center disabled:opacity-30"
                >
                  <Redo2 className="h-4 w-4" />
                </button>
                <button
                  onClick={resetAssignments}
                  className="h-10 px-3 rounded-md border border-input text-sm inline-flex items-center gap-1.5 hover:bg-accent"
                >
                  <RotateCcw className="h-4 w-4" /> Clear seats
                </button>
                <button
                  onClick={exportPNG}
                  className="h-10 px-3 rounded-md border border-input text-sm inline-flex items-center gap-1.5 hover:bg-accent"
                >
                  <Camera className="h-4 w-4" /> PNG
                </button>
                <button
                  onClick={handleAuto}
                  className="h-10 px-4 rounded-md bg-primary text-primary-foreground text-sm inline-flex items-center gap-1.5 hover:opacity-90"
                >
                  <Wand2 className="h-4 w-4" /> Auto-seat
                </button>
              </div>
            </div>

            {/* Search + analytics toggle */}
            <div className="flex items-center gap-3 mb-4">
              <div className="relative flex-1 max-w-md">
                <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  ref={searchRef}
                  placeholder="Find guest on map… (⌘F)"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                />
                {search && matches.length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-popover border border-border rounded-md shadow-lg z-20 max-h-64 overflow-y-auto">
                    {matches.map((g) => {
                      const table = tables.find((t) => t.id === g.tableId);
                      return (
                        <button
                          key={g.id}
                          onClick={() => {
                            if (table) {
                              setHighlightedTableId(table.id);
                              setTimeout(() => setHighlightedTableId(null), 1800);
                            }
                            setSearch("");
                          }}
                          className="w-full text-left px-3 py-2 hover:bg-accent text-sm flex justify-between"
                        >
                          <span>{g.name}</span>
                          <span className="font-mono text-xs text-muted-foreground">
                            {table ? `${table.label} · ${g.seatIndex}` : "unseated"}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
              <button
                onClick={() => setAnalyticsOpen((v) => !v)}
                className="h-10 px-3 rounded-md border border-input text-sm inline-flex items-center gap-1.5 hover:bg-accent"
              >
                <BarChart2 className="h-4 w-4" /> Analytics
                {analyticsOpen ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              </button>
            </div>

            {analyticsOpen && (
              <div className="mb-6 p-4 border border-border rounded-xl bg-card grid sm:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
                <div>
                  <div className="text-xs text-muted-foreground uppercase">Fill rate</div>
                  <div className="font-display text-xl">{stats.seated}/{stats.capacity} ({fillPct}%)</div>
                  <div className="h-1.5 rounded bg-muted mt-1 overflow-hidden">
                    <div className="h-full bg-primary" style={{ width: `${fillPct}%` }} />
                  </div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground uppercase">Meals</div>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {Object.entries(stats.meals).map(([m, c]) => (
                      <span key={m} className="text-[10px] font-mono px-1.5 py-0.5 rounded-full bg-muted">{m}: {c}</span>
                    ))}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground uppercase">Capacity</div>
                  <div className="font-mono">{stats.fullTables} tables full</div>
                  {stats.unassigned > 0 && (
                    <div className="text-destructive font-mono">{stats.unassigned} unassigned</div>
                  )}
                </div>
                <div>
                  <div className="text-xs text-muted-foreground uppercase">Top companies</div>
                  <div className="text-xs">{stats.topCompanies.map(([c, n]) => `${c}: ${n}`).join(" · ") || "—"}</div>
                  {stats.splitCohorts.length > 0 && (
                    <div className="text-[color:var(--color-dietary-alert)] text-xs mt-1">
                      Cohorts split: {stats.splitCohorts.join(", ")}
                    </div>
                  )}
                </div>
              </div>
            )}

            <p className="text-xs text-muted-foreground mb-4">
              Click a seat to select · click another seat to swap · select a guest then click an empty seat · click a table label to edit details · drag tables to reorder.
            </p>

            <PlannerGrid
              selectedGuestId={selectedGuestId}
              onAfterAssign={() => setSelectedGuestId(null)}
              highlightedTableId={highlightedTableId}
              violatingGuestIds={violatingGuestIds}
            />
          </div>
        </div>
        <UnassignedPanel selectedGuestId={selectedGuestId} onSelect={setSelectedGuestId} />
      </div>
    </AppShell>
  );
}

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
  type SeatStrategy,
} from "@/lib/plan-store";
import { toast } from "sonner";
import {
  Wand2, RotateCcw, Settings as SettingsIcon, Undo2, Redo2, Camera,
  Search, BarChart2, ChevronUp, ChevronDown, Building2, Tag as TagIcon, X,
  Plus, UserPlus,
} from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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

const STRATEGIES: { value: SeatStrategy; icon: string; label: string; description: string }[] = [
  { value: "smart",        icon: "🧠", label: "Smart",         description: "Rules-driven, cohorts respected" },
  { value: "spread",       icon: "🔀", label: "Spread",        description: "Mix everyone across tables" },
  { value: "group",        icon: "🏢", label: "By company",    description: "Group same-firm guests together" },
  { value: "alpha",        icon: "🔤", label: "Alphabetical",  description: "Assign guests A → Z" },
  { value: "random",       icon: "🎲", label: "Random",        description: "Shuffle for spontaneous mixing" },
  { value: "vip-first",    icon: "⭐", label: "VIP first",     description: "VIPs fill premium tables first" },
  { value: "sequential",   icon: "📋", label: "Sequential",    description: "Fill each table before the next" },
  { value: "cohort-first", icon: "👥", label: "Cohort first",  description: "Cohorts always intact above all" },
];

const COHORT_PALETTE = [
  "oklch(0.7 0.15 30)",
  "oklch(0.7 0.15 60)",
  "oklch(0.7 0.15 145)",
  "oklch(0.7 0.15 200)",
  "oklch(0.7 0.15 250)",
  "oklch(0.7 0.15 300)",
  "oklch(0.7 0.15 320)",
  "oklch(0.7 0.15 180)",
];

function PlannerPage() {
  const [selectedGuestId, setSelectedGuestId] = useState<string | null>(null);
  const [selectedSeat, setSelectedSeat] = useState<{ tableId: string; seatIndex: number } | null>(null);
  const [pendingSwap, setPendingSwap] = useState<{ a: typeof selectedSeat; b: typeof selectedSeat } | null>(null);

  const settings = usePlanStore((s) => s.settings);
  const setSettings = usePlanStore((s) => s.setSettings);
  const applyNamingScheme = usePlanStore((s) => s.applyNamingScheme);
  const autoSeat = usePlanStore((s) => s.autoSeat);
  const resetAssignments = usePlanStore((s) => s.resetAssignments);
  const swapSeats = usePlanStore((s) => s.swapSeats);
  const guests = usePlanStore((s) => s.guests);
  const tables = usePlanStore((s) => s.tables);
  const rules = usePlanStore((s) => s.rules);
  const addTable = usePlanStore((s) => s.addTable);
  const addGuests = usePlanStore((s) => s.addGuests);

  const pastStates = useTemporalStore((s) => s.pastStates) as any[];
  const futureStates = useTemporalStore((s) => s.futureStates) as any[];

  const [violatingGuestIds, setViolatingGuestIds] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [highlightedTableId, setHighlightedTableId] = useState<string | null>(null);
  const [analyticsOpen, setAnalyticsOpen] = useState(false);
  const [seatLabelMode, setSeatLabelMode] = useState<"none" | "name" | "name+firm">("none");
  const [autoSeatOpen, setAutoSeatOpen] = useState(false);
  const [strategy, setStrategy] = useState<SeatStrategy>("smart");
  const [overwriteOpen, setOverwriteOpen] = useState(false);
  const [rowPatternDraft, setRowPatternDraft] = useState(settings.rowPattern);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => setRowPatternDraft(settings.rowPattern), [settings.rowPattern]);

  // intercept seat clicks for swap confirmation
  function handleSelectSeat(sel: typeof selectedSeat) {
    if (
      sel &&
      selectedSeat &&
      (selectedSeat.tableId !== sel.tableId || selectedSeat.seatIndex !== sel.seatIndex)
    ) {
      setPendingSwap({ a: selectedSeat, b: sel });
      setSelectedSeat(null);
      return;
    }
    setSelectedSeat(sel);
  }

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
        setSelectedSeat(null);
        setSearch("");
        setHighlightedTableId(null);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  function openAutoSeat() {
    if (guests.length === 0) { toast.error("Add or import guests first."); return; }
    setStrategy("smart");
    setAutoSeatOpen(true);
  }

  function runAutoSeat() {
    const hasSeated = guests.some((g) => g.tableId);
    if (hasSeated) {
      setAutoSeatOpen(false);
      setOverwriteOpen(true);
      return;
    }
    commitAutoSeat();
  }

  function commitAutoSeat() {
    const r = autoSeat(strategy);
    setViolatingGuestIds(new Set(r.violatingGuestIds));
    setAutoSeatOpen(false);
    setOverwriteOpen(false);
    const label = STRATEGIES.find((s) => s.value === strategy)?.label ?? strategy;
    toast.success(`${label}: seated ${r.assigned} of ${guests.length}`, {
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

  const matches = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return [];
    return guests
      .filter((g) =>
        g.name.toLowerCase().includes(q) || (g.company ?? "").toLowerCase().includes(q),
      )
      .slice(0, 8);
  }, [search, guests]);

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

  const cohortColorMap = useMemo(() => {
    const m = new Map<string, string>();
    const cohorts = [...new Set(guests.map((g) => g.cohort).filter(Boolean) as string[])];
    cohorts.sort();
    cohorts.forEach((c, i) => m.set(c, COHORT_PALETTE[i % COHORT_PALETTE.length]));
    return m;
  }, [guests]);

  const schemePreview = useMemo(() => {
    const vocab = NAMING_VOCAB[settings.namingScheme];
    if (vocab) return vocab.slice(0, 4).join(" · ");
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

  const activeRules = rules.filter((r) => r.enabled);
  const eligibleCount = guests.filter((g) => g.rsvpStatus !== "Declined" && g.rsvpStatus !== "No-show").length;
  const totalSeats = tables.reduce((a, t) => a + t.seats, 0);

  const selectedSeatGuest = selectedSeat
    ? guests.find((g) => g.tableId === selectedSeat.tableId && g.seatIndex === selectedSeat.seatIndex)
    : null;
  const selectedSeatTableLabel = selectedSeat ? tables.find((t) => t.id === selectedSeat.tableId)?.label : undefined;

  function nextSeatLabelMode() {
    setSeatLabelMode((m) => (m === "none" ? "name" : m === "name" ? "name+firm" : "none"));
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
                  {tables.length} tables · {totalSeats} seats
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
                  onClick={openAutoSeat}
                  className="h-10 px-4 rounded-md bg-primary text-primary-foreground text-sm inline-flex items-center gap-1.5 hover:opacity-90"
                >
                  <Wand2 className="h-4 w-4" /> Auto-seat
                </button>
              </div>
            </div>

            {/* Row 2 — search + view controls */}
            <div className="flex items-center gap-3 mb-4 flex-wrap">
              <div className="relative flex-1 max-w-md min-w-[240px]">
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
              <button
                onClick={() => setSettings({ showFirmInList: !settings.showFirmInList })}
                className={`h-10 px-3 rounded-md border border-input text-sm inline-flex items-center gap-1.5 ${settings.showFirmInList ? "bg-accent" : "hover:bg-accent"}`}
                title="Show company in per-table guest lists"
              >
                <Building2 className="h-4 w-4" /> Show firms
              </button>
              <button
                onClick={nextSeatLabelMode}
                className={`h-10 px-3 rounded-md border border-input text-sm inline-flex items-center gap-1.5 ${seatLabelMode !== "none" ? "bg-accent" : "hover:bg-accent"}`}
                title="Cycle seat label display"
              >
                <TagIcon className="h-4 w-4" />
                {seatLabelMode === "none" ? "Labels: off" : seatLabelMode === "name" ? "Labels: name" : "Labels: name+firm"}
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

            {cohortColorMap.size > 0 && (
              <div className="flex flex-wrap gap-2 mb-4">
                {[...cohortColorMap.entries()].map(([c, color]) => (
                  <span key={c} className="text-[11px] inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-muted">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ background: color }} />
                    {c}
                  </span>
                ))}
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
              cohortColorMap={cohortColorMap}
              seatLabelMode={seatLabelMode}
              selectedSeat={selectedSeat}
              onSelectSeat={handleSelectSeat}
            />
          </div>
        </div>
        <UnassignedPanel selectedGuestId={selectedGuestId} onSelect={setSelectedGuestId} />
      </div>

      {/* Selection banner */}
      {selectedSeat && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 max-w-[90vw] bg-[color:var(--color-rsvp-pending)]/95 text-foreground border border-[color:var(--color-rsvp-pending)] rounded-xl shadow-lg px-4 py-2 flex items-center gap-3 text-sm">
          <span className="font-medium">
            {selectedSeatGuest ? selectedSeatGuest.name : "Empty seat"} · Table {selectedSeatTableLabel} · Seat {selectedSeat.seatIndex}
          </span>
          <span className="text-xs">— click destination seat to swap</span>
          <button onClick={() => setSelectedSeat(null)} className="ml-2 inline-flex items-center gap-1 text-xs hover:underline">
            <X className="h-3 w-3" /> Cancel
          </button>
        </div>
      )}

      {/* Pending swap confirmation */}
      <AlertDialog open={!!pendingSwap} onOpenChange={(v) => !v && setPendingSwap(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm seat swap</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingSwap && (() => {
                const ga = guests.find((g) => g.tableId === pendingSwap.a?.tableId && g.seatIndex === pendingSwap.a?.seatIndex);
                const gb = guests.find((g) => g.tableId === pendingSwap.b?.tableId && g.seatIndex === pendingSwap.b?.seatIndex);
                const tla = tables.find((t) => t.id === pendingSwap.a?.tableId)?.label;
                const tlb = tables.find((t) => t.id === pendingSwap.b?.tableId)?.label;
                return `${ga?.name ?? "empty seat"} (Table ${tla} · Seat ${pendingSwap.a?.seatIndex}) ↔ ${gb?.name ?? "empty seat"} (Table ${tlb} · Seat ${pendingSwap.b?.seatIndex})`;
              })()}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => {
              if (pendingSwap?.a && pendingSwap.b) swapSeats(pendingSwap.a, pendingSwap.b);
              setPendingSwap(null);
            }}>Swap</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Auto-seat strategy dialog */}
      <Dialog open={autoSeatOpen} onOpenChange={setAutoSeatOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Auto-seat guests</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="text-xs text-muted-foreground font-mono">
              {eligibleCount} guests to seat · {tables.length} tables · {totalSeats} seats available
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {STRATEGIES.map((s) => {
                const active = strategy === s.value;
                return (
                  <button
                    key={s.value}
                    onClick={() => setStrategy(s.value)}
                    className={`p-3 rounded-lg border text-left transition ${active ? "border-primary bg-accent" : "border-border hover:border-foreground/40"}`}
                  >
                    <div className="text-2xl">{s.icon}</div>
                    <div className="font-medium text-sm mt-1">{s.label}</div>
                    <div className="text-[11px] text-muted-foreground">{s.description}</div>
                  </button>
                );
              })}
            </div>
            <div>
              <div className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Active rules</div>
              {activeRules.length === 0 ? (
                <div className="text-xs text-muted-foreground italic">No rules active.</div>
              ) : (
                <ul className="text-xs space-y-1">
                  {activeRules.map((r) => (
                    <li key={r.id} className="text-muted-foreground">
                      • {r.type.replace(/_/g, " ")}{r.cohort ? `: ${r.cohort}` : ""}{r.guestIds ? ` (${r.guestIds.length} guests)` : ""}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
          <DialogFooter>
            <button onClick={() => setAutoSeatOpen(false)} className="h-9 px-3 rounded-md border border-input text-sm">Cancel</button>
            <button onClick={runAutoSeat} className="h-9 px-4 rounded-md bg-primary text-primary-foreground text-sm">Run auto-seat →</button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={overwriteOpen} onOpenChange={setOverwriteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Overwrite existing assignments?</AlertDialogTitle>
            <AlertDialogDescription>
              {guests.filter((g) => g.tableId).length} guests are already seated. Auto-seat will reassign everyone from scratch.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={commitAutoSeat} className="bg-destructive hover:bg-destructive/90">Reassign all</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppShell>
  );
}

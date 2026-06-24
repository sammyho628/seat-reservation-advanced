import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { PlannerGrid } from "@/components/PlannerGrid";
import { UnassignedPanel } from "@/components/UnassignedPanel";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import {
  usePlanStore,
  useTemporalStore,
  NAMING_VOCAB,
  type NamingScheme,
  type SeatStrategy,
} from "@/lib/plan-store";
import { toast } from "sonner";
import { AutoAssignDrawer } from "@/components/AutoAssignDrawer";
import {
  Wand2, RotateCcw, Settings as SettingsIcon, Undo2, Redo2, Camera,
  Search, BarChart2, ChevronUp, ChevronDown, Building2, Tag as TagIcon, X,
  Plus, UserPlus, Save, FolderOpen, FilePlus, Upload,
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
  const exportPlan = usePlanStore((s) => s.exportPlan);
  const importPlan = usePlanStore((s) => s.importPlan);
  const resetPlan = usePlanStore((s) => s.resetPlan);

  const [newPlanOpen, setNewPlanOpen] = useState(false);

  async function handleOpenFile() {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json,application/json";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      try {
        const data = JSON.parse(await file.text());
        const ok = importPlan(data);
        if (ok) toast.success(`Loaded "${file.name}"`);
        else toast.error("Could not load file — invalid Seatcraft plan");
      } catch {
        toast.error("Could not load file — is it a valid Seatcraft plan?");
      }
    };
    input.click();
  }

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
                  <div className="flex gap-1 mt-1">
                    <Input
                      className="w-28 font-mono"
                      value={rowPatternDraft}
                      onChange={(e) => setRowPatternDraft(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && setSettings({ rowPattern: rowPatternDraft })}
                    />
                    <button
                      onClick={() => setSettings({ rowPattern: rowPatternDraft })}
                      className="h-10 px-2.5 rounded-md border border-input hover:bg-accent text-sm font-medium"
                    >
                      Apply
                    </button>
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-0.5">e.g. 4:4:4 = 3 rows of 4</p>
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
                  onClick={addTable}
                  className="h-10 px-3 rounded-md border border-input text-sm inline-flex items-center gap-1.5 hover:bg-accent"
                  title="Add a table"
                >
                  <Plus className="h-4 w-4" /> Table
                </button>
                <button
                  onClick={() => {
                    addGuests([{ name: "New guest", meal: "None", tags: [], rsvpStatus: "Confirmed" }]);
                    toast.success("Added blank guest");
                  }}
                  className="h-10 px-3 rounded-md border border-input text-sm inline-flex items-center gap-1.5 hover:bg-accent"
                  title="Add a blank guest"
                >
                  <UserPlus className="h-4 w-4" /> Guest
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

                <div className="h-8 w-px bg-border mx-1" />

                <button
                  onClick={exportPlan}
                  title="Save plan to file"
                  className="h-10 px-3 rounded-md border border-input text-sm inline-flex items-center gap-1.5 hover:bg-accent"
                >
                  <Save className="h-4 w-4" /> Save
                </button>
                <button
                  onClick={handleOpenFile}
                  title="Open a .seatcraft.json file"
                  className="h-10 px-3 rounded-md border border-input text-sm inline-flex items-center gap-1.5 hover:bg-accent"
                >
                  <FolderOpen className="h-4 w-4" /> Open
                </button>
                <button
                  onClick={() => setNewPlanOpen(true)}
                  title="Start a new blank plan"
                  className="h-10 px-3 rounded-md border border-input text-sm inline-flex items-center gap-1.5 hover:bg-accent"
                >
                  <FilePlus className="h-4 w-4" /> New
                </button>

                <div className="h-8 w-px bg-border mx-1" />

                <button
                  onClick={openAutoSeat}
                  className="h-10 px-4 rounded-md bg-primary text-primary-foreground text-sm inline-flex items-center gap-1.5 hover:opacity-90"
                >
                  <Wand2 className="h-4 w-4" /> Auto-Assign
                </button>
              </div>
            </div>

            <AlertDialog open={newPlanOpen} onOpenChange={setNewPlanOpen}>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Start a new plan?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will clear all tables, guests and rules. Save your current plan first if you want to keep it.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => { resetPlan(); setNewPlanOpen(false); toast.success("New plan created"); }}
                    className="bg-destructive hover:bg-destructive/90"
                  >
                    Clear and start new
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>


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

            {tables.length === 0 && guests.length === 0 ? (
              <div className="flex items-center justify-center py-20">
                <div className="w-full max-w-2xl rounded-2xl border border-border bg-card shadow-sm p-10">
                  <div className="text-center mb-8">
                    <h2 className="font-display text-4xl mb-2">Seatcraft</h2>
                    <p className="text-muted-foreground text-sm">Professional event seating planner</p>
                  </div>
                  <div className="grid sm:grid-cols-2 gap-4">
                    <button
                      onClick={addTable}
                      className="flex flex-col items-center gap-2 p-6 border-2 border-dashed border-border rounded-xl hover:border-primary hover:bg-accent/30 transition group"
                    >
                      <FilePlus className="h-8 w-8 text-muted-foreground group-hover:text-primary transition" />
                      <span className="font-medium">New plan</span>
                      <span className="text-xs text-muted-foreground text-center">Add your first table to get started</span>
                    </button>
                    <button
                      onClick={handleOpenFile}
                      className="flex flex-col items-center gap-2 p-6 border-2 border-dashed border-border rounded-xl hover:border-primary hover:bg-accent/30 transition group"
                    >
                      <FolderOpen className="h-8 w-8 text-muted-foreground group-hover:text-primary transition" />
                      <span className="font-medium">Open plan</span>
                      <span className="text-xs text-muted-foreground text-center">Load a .seatcraft.json file</span>
                    </button>
                  </div>
                  <p className="text-xs text-muted-foreground text-center mt-6">
                    Or head to{" "}
                    <a href="/guests" className="text-primary hover:underline">Guests</a>
                    {" "}to import a CSV or Excel list.
                  </p>
                </div>
              </div>
            ) : (
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
            )}
          </div>
        </div>
        <UnassignedPanel selectedGuestId={selectedGuestId} onSelect={setSelectedGuestId} />
      </div>

      {/* Persistent swap status bar */}
      {(selectedSeat || pendingSwap) && (
        <div className="fixed bottom-0 left-0 right-0 z-50 border-t-2 border-amber-400 bg-amber-50 dark:bg-amber-950/90 shadow-xl px-6 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-2.5 w-2.5 rounded-full bg-amber-500 animate-pulse shrink-0" />
            {selectedSeat ? (
              <span className="font-medium text-amber-900 dark:text-amber-100 text-sm">
                <span className="font-bold">{selectedSeatGuest?.name ?? "Empty seat"}</span>
                {selectedSeatGuest?.company && (
                  <span className="font-normal text-amber-700 dark:text-amber-300"> · {selectedSeatGuest.company}</span>
                )}
                <span className="font-mono text-xs text-amber-700 dark:text-amber-400 ml-1">
                  (Table {selectedSeatTableLabel} · Seat {selectedSeat.seatIndex})
                </span>
                <span className="font-normal text-amber-700 dark:text-amber-300 ml-2">→ click another seat to swap</span>
              </span>
            ) : pendingSwap ? (() => {
              const gA = guests.find((g) => g.tableId === pendingSwap.a?.tableId && g.seatIndex === pendingSwap.a?.seatIndex);
              const gB = guests.find((g) => g.tableId === pendingSwap.b?.tableId && g.seatIndex === pendingSwap.b?.seatIndex);
              const tA = tables.find((t) => t.id === pendingSwap.a?.tableId);
              const tB = tables.find((t) => t.id === pendingSwap.b?.tableId);
              return (
                <div className="flex flex-col gap-0.5">
                  <span className="text-xs text-amber-700 dark:text-amber-300 font-medium uppercase tracking-wider">Confirm swap</span>
                  <span className="font-medium text-amber-900 dark:text-amber-100 text-sm flex flex-wrap items-center gap-2">
                    <span>
                      <span className="font-bold">{gA?.name ?? "Empty seat"}</span>
                      {gA?.company && <span className="font-normal text-amber-700"> · {gA.company}</span>}
                      <span className="font-mono text-xs text-amber-700 ml-1">(Table {tA?.label ?? "?"} · Seat {pendingSwap.a?.seatIndex})</span>
                    </span>
                    <span className="text-amber-500 font-bold">⇄</span>
                    <span>
                      <span className="font-bold">{gB?.name ?? "Empty seat"}</span>
                      {gB?.company && <span className="font-normal text-amber-700"> · {gB.company}</span>}
                      <span className="font-mono text-xs text-amber-700 ml-1">(Table {tB?.label ?? "?"} · Seat {pendingSwap.b?.seatIndex})</span>
                    </span>
                  </span>
                </div>
              );
            })() : null}

          </div>
          <div className="flex items-center gap-2 shrink-0">
            {pendingSwap && (
              <button
                onClick={() => {
                  if (pendingSwap.a && pendingSwap.b) swapSeats(pendingSwap.a, pendingSwap.b);
                  setPendingSwap(null);
                }}
                className="h-8 px-4 rounded-md bg-amber-600 hover:bg-amber-700 text-white text-sm font-semibold"
              >
                ✓ Confirm swap
              </button>
            )}
            <button
              onClick={() => { setSelectedSeat(null); setPendingSwap(null); }}
              className="h-8 px-3 rounded-md bg-amber-200 hover:bg-amber-300 text-amber-900 text-sm inline-flex items-center gap-1"
            >
              <X className="h-3 w-3" /> Cancel
            </button>
          </div>
        </div>
      )}


      <AutoAssignDrawer
        open={autoSeatOpen}
        onOpenChange={setAutoSeatOpen}
        strategy={strategy}
        setStrategy={setStrategy}
        onRun={runAutoSeat}
      />

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

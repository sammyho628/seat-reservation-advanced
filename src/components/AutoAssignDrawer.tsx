import { usePlanStore, type RuleType, type SeatStrategy } from "@/lib/plan-store";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Plus, Trash2, X, Wand2 } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

const RULE_OPTIONS: { type: RuleType; label: string; description: string; needsGuests: boolean; needsCohort?: boolean; maxGuests?: number }[] = [
  { type: "keep_together", label: "Keep together", description: "Guests share a table.", needsGuests: true },
  { type: "keep_apart", label: "Keep apart", description: "Guests cannot share a table.", needsGuests: true },
  { type: "seat_adjacent", label: "Seat adjacent", description: "Two guests in adjacent seats.", needsGuests: true, maxGuests: 2 },
  { type: "keep_cohort_together", label: "Keep cohort together", description: "All in cohort at same table.", needsGuests: false, needsCohort: true },
  { type: "vip_near_stage", label: "VIPs near stage", description: "VIP-tagged guests near stage.", needsGuests: false },
  { type: "accessibility_edge", label: "Accessibility on edges", description: "Wheelchair tag → edge tables.", needsGuests: false },
  { type: "balance_company", label: "Mix companies", description: "Spread same firm across tables.", needsGuests: false },
];

const STRATEGIES: { value: SeatStrategy; icon: string; label: string; description: string }[] = [
  { value: "smart",        icon: "🧠", label: "Smart",         description: "Rules-driven, cohorts respected" },
  { value: "spread",       icon: "🔀", label: "Spread",        description: "Mix everyone across tables" },
  { value: "group",        icon: "🏢", label: "By company",    description: "Group same-firm guests" },
  { value: "alpha",        icon: "🔤", label: "Alphabetical",  description: "Assign A → Z" },
  { value: "random",       icon: "🎲", label: "Random",        description: "Shuffle randomly" },
  { value: "vip-first",    icon: "⭐", label: "VIP first",     description: "VIPs fill premium tables" },
  { value: "sequential",   icon: "📋", label: "Sequential",    description: "Fill table by table" },
  { value: "cohort-first", icon: "👥", label: "Cohort first",  description: "Cohorts intact above all" },
];

function GuestPicker({ selectedIds, onChange, max }: { selectedIds: string[]; onChange: (ids: string[]) => void; max?: number }) {
  const guests = usePlanStore((s) => s.guests);
  const [q, setQ] = useState("");
  const atMax = max !== undefined && selectedIds.length >= max;
  const matches = useMemo(() => {
    if (!q.trim() || atMax) return [];
    const lower = q.toLowerCase();
    return guests
      .filter((g) => !selectedIds.includes(g.id) && (g.name.toLowerCase().includes(lower) || (g.company ?? "").toLowerCase().includes(lower)))
      .slice(0, 6);
  }, [q, guests, selectedIds, atMax]);
  const selectedGuests = selectedIds.map((id) => guests.find((g) => g.id === id)).filter(Boolean) as typeof guests;
  return (
    <div>
      <div className="flex flex-wrap gap-1 mb-2">
        {selectedGuests.map((g) => (
          <span key={g.id} className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary inline-flex items-center gap-1">
            {g.name}
            <button onClick={() => onChange(selectedIds.filter((x) => x !== g.id))}><X className="h-3 w-3" /></button>
          </span>
        ))}
      </div>
      <div className="relative">
        <Input placeholder={atMax ? `Max ${max} selected` : "Search guests…"} value={q} onChange={(e) => setQ(e.target.value)} disabled={atMax} className="h-8 text-xs" />
        {matches.length > 0 && (
          <div className="absolute top-full mt-1 left-0 right-0 z-10 bg-popover border border-border rounded-md shadow-lg max-h-40 overflow-y-auto">
            {matches.map((g) => (
              <button key={g.id} onClick={() => { onChange([...selectedIds, g.id]); setQ(""); }} className="w-full text-left px-3 py-1 hover:bg-accent text-xs flex justify-between">
                <span>{g.name}</span>
                <span className="text-[10px] text-muted-foreground">{g.cohort || g.company || ""}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export function AutoAssignDrawer({
  open,
  onOpenChange,
  strategy,
  setStrategy,
  onRun,
  onFillGaps,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  strategy: SeatStrategy;
  setStrategy: (s: SeatStrategy) => void;
  onRun: () => void;
  onFillGaps: () => void;
}) {
  const rules = usePlanStore((s) => s.rules);
  const guests = usePlanStore((s) => s.guests);
  const addRule = usePlanStore((s) => s.addRule);
  const updateRule = usePlanStore((s) => s.updateRule);
  const removeRule = usePlanStore((s) => s.removeRule);
  const [showAddRule, setShowAddRule] = useState(false);

  const unassigned = guests.filter((g) => !g.tableId && g.rsvpStatus !== "Declined" && g.rsvpStatus !== "No-show" && g.rsvpStatus !== "Withdrawn").length;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2"><Wand2 className="h-5 w-5" /> Auto-Assign</SheetTitle>
        </SheetHeader>

        <div className="px-4 space-y-6 pb-32">
          {/* Section 1: Rules */}
          <section>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs uppercase tracking-wider text-muted-foreground">Rules ({rules.length})</h3>
              <button
                onClick={() => setShowAddRule((v) => !v)}
                className="text-xs px-2 py-1 rounded-md border border-input hover:bg-accent inline-flex items-center gap-1"
              >
                <Plus className="h-3 w-3" /> Add rule
              </button>
            </div>

            {showAddRule && (
              <div className="grid grid-cols-2 gap-1.5 mb-3 p-2 border border-border rounded-lg bg-muted/30">
                {RULE_OPTIONS.map((opt) => (
                  <button
                    key={opt.type}
                    onClick={() => {
                      addRule({ type: opt.type, enabled: true, guestIds: opt.needsGuests ? [] : undefined, cohort: opt.needsCohort ? "" : undefined });
                      setShowAddRule(false);
                      toast.success(`Added rule: ${opt.label}`);
                    }}
                    className="text-left p-2 text-xs border border-border rounded hover:border-foreground/40 hover:bg-accent transition bg-background"
                  >
                    <div className="font-medium">{opt.label}</div>
                    <div className="text-[10px] text-muted-foreground mt-0.5">{opt.description}</div>
                  </button>
                ))}
              </div>
            )}

            {rules.length === 0 ? (
              <p className="text-xs text-muted-foreground italic">No rules yet — auto-seat will spread guests.</p>
            ) : (
              <div className="space-y-2">
                {rules.map((r) => {
                  const opt = RULE_OPTIONS.find((o) => o.type === r.type)!;
                  return (
                    <div key={r.id} className="border border-border rounded-lg p-2 bg-card">
                      <div className="flex items-start gap-2">
                        <Switch checked={r.enabled} onCheckedChange={(v) => updateRule(r.id, { enabled: v })} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 mb-0.5">
                            <span className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-muted text-muted-foreground">{r.type.replace(/_/g, " ")}</span>
                          </div>
                          {opt.needsGuests && (
                            <GuestPicker
                              selectedIds={r.guestIds ?? []}
                              onChange={(ids) => updateRule(r.id, { guestIds: ids })}
                              max={opt.maxGuests}
                            />
                          )}
                          {opt.needsCohort && (
                            <Input
                              value={r.cohort ?? ""}
                              onChange={(e) => updateRule(r.id, { cohort: e.target.value })}
                              placeholder="Cohort name"
                              className="h-8 text-xs"
                            />
                          )}
                        </div>
                        <button onClick={() => removeRule(r.id)} className="text-muted-foreground hover:text-destructive p-1">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* Section 2: Strategy */}
          <section>
            <h3 className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Strategy</h3>
            <div className="grid grid-cols-2 gap-1.5">
              {STRATEGIES.map((s) => {
                const active = strategy === s.value;
                return (
                  <button
                    key={s.value}
                    onClick={() => setStrategy(s.value)}
                    className={`p-2 rounded-lg border text-left transition ${active ? "border-primary bg-accent" : "border-border hover:border-foreground/40"}`}
                  >
                    <div className="text-xl">{s.icon}</div>
                    <div className="font-medium text-xs mt-0.5">{s.label}</div>
                    <div className="text-[10px] text-muted-foreground leading-tight">{s.description}</div>
                  </button>
                );
              })}
            </div>
          </section>

          {/* Section 3: Run */}
          <section>
            <div className="text-xs text-muted-foreground mb-2 text-center">
              {unassigned > 0 ? <><span className="font-mono font-medium text-foreground">{unassigned}</span> guest{unassigned === 1 ? "" : "s"} unassigned</> : "All guests are seated"}
            </div>
            <button
              onClick={onRun}
              className="w-full h-11 rounded-md bg-primary text-primary-foreground text-sm font-medium inline-flex items-center justify-center gap-2 hover:opacity-90"
            >
              <Wand2 className="h-4 w-4" /> Run Auto-Seat
            </button>
          </section>
        </div>
      </SheetContent>
    </Sheet>
  );
}

import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { usePlanStore, type RuleType } from "@/lib/plan-store";
import { Plus, Trash2, X, ShieldAlert } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { useMemo, useState } from "react";

export const Route = createFileRoute("/rules")({
  ssr: false,
  head: () => ({ meta: [{ title: "Rules · Seatcraft" }] }),
  component: RulesPage,
});

const RULE_OPTIONS: { type: RuleType; label: string; description: string; needsGuests: boolean; needsCohort?: boolean; maxGuests?: number }[] = [
  { type: "keep_together", label: "Keep together", description: "These guests must share a table.", needsGuests: true },
  { type: "keep_apart", label: "Keep apart", description: "These guests cannot share a table.", needsGuests: true },
  { type: "seat_adjacent", label: "Seat adjacent", description: "Two specific guests will be placed in adjacent seats (next to each other) at the same table.", needsGuests: true, maxGuests: 2 },
  { type: "keep_cohort_together", label: "Keep cohort together", description: "All guests sharing a cohort name sit at the same table.", needsGuests: false, needsCohort: true },
  { type: "vip_near_stage", label: "VIPs near the stage", description: "Guests tagged VIP get front-row tables first.", needsGuests: false },
  { type: "accessibility_edge", label: "Accessibility on edges", description: "Guests tagged Wheelchair get edge tables.", needsGuests: false },
  { type: "balance_company", label: "Mix companies", description: "Spread guests from the same company across tables.", needsGuests: false },
];

function GuestPicker({
  selectedIds,
  onChange,
  max,
}: {
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  max?: number;
}) {
  const guests = usePlanStore((s) => s.guests);
  const [q, setQ] = useState("");
  const atMax = max !== undefined && selectedIds.length >= max;
  const matches = useMemo(() => {
    if (!q.trim() || atMax) return [];
    const lower = q.toLowerCase();
    return guests
      .filter(
        (g) =>
          !selectedIds.includes(g.id) &&
          (g.name.toLowerCase().includes(lower) || (g.company ?? "").toLowerCase().includes(lower)),
      )
      .slice(0, 6);
  }, [q, guests, selectedIds]);

  const selectedGuests = selectedIds
    .map((id) => guests.find((g) => g.id === id))
    .filter(Boolean) as typeof guests;

  return (
    <div>
      <div className="flex flex-wrap gap-1 mb-2">
        {selectedGuests.map((g) => (
          <span key={g.id} className="text-xs px-2 py-1 rounded-full bg-primary/10 text-primary inline-flex items-center gap-1">
            {g.name}
            {g.cohort && <span className="opacity-70">· {g.cohort}</span>}
            <button onClick={() => onChange(selectedIds.filter((x) => x !== g.id))}>
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
      </div>
      <div className="relative">
        <Input
          placeholder={atMax ? `Max ${max} guests selected` : "Search guests…"}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          disabled={atMax}
        />
        {matches.length > 0 && (
          <div className="absolute top-full mt-1 left-0 right-0 z-10 bg-popover border border-border rounded-md shadow-lg max-h-48 overflow-y-auto">
            {matches.map((g) => (
              <button
                key={g.id}
                onClick={() => { onChange([...selectedIds, g.id]); setQ(""); }}
                className="w-full text-left px-3 py-1.5 hover:bg-accent text-sm flex justify-between"
              >
                <span>{g.name}</span>
                <span className="text-xs text-muted-foreground">{g.cohort || g.company || ""}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function CohortPicker({ value, onChange }: { value?: string; onChange: (v: string) => void }) {
  const guests = usePlanStore((s) => s.guests);
  const cohorts = useMemo(() => {
    const set = new Set<string>();
    guests.forEach((g) => { if (g.cohort) set.add(g.cohort); });
    return [...set].sort();
  }, [guests]);
  return (
    <div>
      <Input value={value ?? ""} onChange={(e) => onChange(e.target.value)} placeholder="Cohort name" list="cohort-options" />
      <datalist id="cohort-options">{cohorts.map((c) => <option key={c} value={c} />)}</datalist>
    </div>
  );
}

function RulesPage() {
  const rules = usePlanStore((s) => s.rules);
  const guests = usePlanStore((s) => s.guests);
  const addRule = usePlanStore((s) => s.addRule);
  const updateRule = usePlanStore((s) => s.updateRule);
  const removeRule = usePlanStore((s) => s.removeRule);
  const autoSeat = usePlanStore((s) => s.autoSeat);

  const [check, setCheck] = useState<{ violations: number; names: string[] } | null>(null);

  function runCheck() {
    const r = autoSeat("smart", false);
    const names = r.violatingGuestIds.map((id) => guests.find((g) => g.id === id)?.name || id).slice(0, 20);
    setCheck({ violations: r.violations, names });
  }

  return (
    <AppShell>
      <div className="max-w-3xl mx-auto px-6 py-8">
        <div className="mb-8 pb-6 border-b border-border/60">
          <h1 className="font-display text-4xl">Rules</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Soft and hard constraints used by the auto-seater. Toggle off to ignore.
          </p>
        </div>

        <section className="mb-10">
          <h2 className="text-sm uppercase tracking-wider text-muted-foreground mb-3">Add a rule</h2>
          <div className="grid sm:grid-cols-2 gap-2">
            {RULE_OPTIONS.map((opt) => (
              <button
                key={opt.type}
                onClick={() =>
                  addRule({
                    type: opt.type,
                    enabled: true,
                    guestIds: opt.needsGuests ? [] : undefined,
                    cohort: opt.needsCohort ? "" : undefined,
                  })
                }
                className="text-left p-3 border border-border rounded-lg hover:border-foreground/40 hover:bg-accent transition"
              >
                <div className="flex items-center gap-2 font-medium text-sm">
                  <Plus className="h-3.5 w-3.5" /> {opt.label}
                </div>
                <p className="text-xs text-muted-foreground mt-1">{opt.description}</p>
              </button>
            ))}
          </div>
        </section>

        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm uppercase tracking-wider text-muted-foreground">Active rules ({rules.length})</h2>
            <button onClick={runCheck} className="text-xs px-3 py-1.5 rounded-md border border-input hover:bg-accent inline-flex items-center gap-1.5">
              <ShieldAlert className="h-3.5 w-3.5" /> Run check
            </button>
          </div>
          {check && (
            <div className="mb-4 p-3 border border-border rounded-lg bg-card text-sm">
              {check.violations === 0 ? (
                <span className="text-[color:var(--color-rsvp-confirmed)]">No unresolvable conflicts detected.</span>
              ) : (
                <>
                  <div className="text-[color:var(--color-violation)] font-medium mb-1">
                    {check.violations} guest(s) cannot be seated without violating rules
                  </div>
                  <div className="text-xs text-muted-foreground">{check.names.join(", ")}</div>
                </>
              )}
            </div>
          )}
          {rules.length === 0 ? (
            <p className="text-sm text-muted-foreground italic">No rules yet. Auto-seat will spread guests across tables.</p>
          ) : (
            <div className="space-y-2">
              {rules.map((r, idx) => {
                const opt = RULE_OPTIONS.find((o) => o.type === r.type)!;
                const sameTypeBefore = rules.slice(0, idx).filter((x) => x.type === r.type).length;
                const sameTypeTotal = rules.filter((x) => x.type === r.type).length;
                const groupLabel = opt.type === "keep_together" && sameTypeTotal > 1 ? ` · Group ${sameTypeBefore + 1}` : "";
                return (
                  <div key={r.id} className="border border-border rounded-lg p-3 bg-card">
                    <div className="flex items-start gap-3">
                      <Switch checked={r.enabled} onCheckedChange={(v) => updateRule(r.id, { enabled: v })} />
                      <div className="flex-1">
                        <div className="font-medium text-sm">{opt.label}{groupLabel}</div>
                        <p className="text-xs text-muted-foreground">{opt.description}</p>
                        {opt.needsGuests && (
                          <div className="mt-2">
                            <GuestPicker
                              selectedIds={r.guestIds ?? []}
                              onChange={(ids) => updateRule(r.id, { guestIds: ids })}
                              max={opt.maxGuests}
                            />
                          </div>
                        )}
                        {opt.needsCohort && (
                          <div className="mt-2">
                            <CohortPicker value={r.cohort} onChange={(v) => updateRule(r.id, { cohort: v })} />
                          </div>
                        )}
                      </div>
                      <button onClick={() => removeRule(r.id)} className="text-muted-foreground hover:text-destructive p-1">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </AppShell>
  );
}

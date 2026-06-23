import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { usePlanStore, type RuleType } from "@/lib/plan-store";
import { Plus, Trash2 } from "lucide-react";
import { Switch } from "@/components/ui/switch";

export const Route = createFileRoute("/rules")({
  head: () => ({ meta: [{ title: "Rules · Seatcraft" }] }),
  component: RulesPage,
});

const RULE_OPTIONS: { type: RuleType; label: string; description: string; needsGuests: boolean }[] = [
  {
    type: "keep_together",
    label: "Keep together",
    description: "These guests must share a table.",
    needsGuests: true,
  },
  {
    type: "keep_apart",
    label: "Keep apart",
    description: "These guests cannot share a table.",
    needsGuests: true,
  },
  {
    type: "vip_near_stage",
    label: "VIPs near the stage",
    description: "Guests tagged VIP get front-row tables first.",
    needsGuests: false,
  },
  {
    type: "accessibility_edge",
    label: "Accessibility on edges",
    description: "Guests tagged Wheelchair get edge tables (easier access).",
    needsGuests: false,
  },
  {
    type: "balance_company",
    label: "Mix companies",
    description: "Spread guests from the same company across tables.",
    needsGuests: false,
  },
];

function RulesPage() {
  const rules = usePlanStore((s) => s.rules);
  const guests = usePlanStore((s) => s.guests);
  const addRule = usePlanStore((s) => s.addRule);
  const updateRule = usePlanStore((s) => s.updateRule);
  const removeRule = usePlanStore((s) => s.removeRule);

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
                  addRule({ type: opt.type, enabled: true, guestIds: opt.needsGuests ? [] : undefined })
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
          <h2 className="text-sm uppercase tracking-wider text-muted-foreground mb-3">
            Active rules ({rules.length})
          </h2>
          {rules.length === 0 ? (
            <p className="text-sm text-muted-foreground italic">No rules yet. Auto-seat will simply spread guests across tables.</p>
          ) : (
            <div className="space-y-2">
              {rules.map((r) => {
                const opt = RULE_OPTIONS.find((o) => o.type === r.type)!;
                return (
                  <div key={r.id} className="border border-border rounded-lg p-3 bg-card">
                    <div className="flex items-start gap-3">
                      <Switch
                        checked={r.enabled}
                        onCheckedChange={(v) => updateRule(r.id, { enabled: v })}
                      />
                      <div className="flex-1">
                        <div className="font-medium text-sm">{opt.label}</div>
                        <p className="text-xs text-muted-foreground">{opt.description}</p>
                        {opt.needsGuests && (
                          <div className="mt-2">
                            <select
                              multiple
                              value={r.guestIds ?? []}
                              onChange={(e) =>
                                updateRule(r.id, {
                                  guestIds: Array.from(e.target.selectedOptions).map((o) => o.value),
                                })
                              }
                              className="w-full text-xs border border-input rounded p-1 h-32 bg-background"
                            >
                              {guests.map((g) => (
                                <option key={g.id} value={g.id}>
                                  {g.name} {g.company ? `· ${g.company}` : ""}
                                </option>
                              ))}
                            </select>
                            <p className="text-[10px] text-muted-foreground mt-1">
                              Hold ⌘/Ctrl to select multiple guests.
                            </p>
                          </div>
                        )}
                      </div>
                      <button
                        onClick={() => removeRule(r.id)}
                        className="text-muted-foreground hover:text-destructive p-1"
                      >
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

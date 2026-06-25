import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { usePlanStore } from "@/lib/plan-store";
import { runSmartChecks, type CheckWarning } from "@/lib/smart-checks";
import { useMemo } from "react";
import { TriangleAlert, Info } from "lucide-react";

const CATEGORY_LABELS: Record<CheckWarning["category"], string> = {
  duplicate_name: "Duplicate Names",
  similar_company: "Similar Company Names",
  meal_conflict: "Meal / Dietary Conflicts",
  rule_violation: "Seating Rule Violations",
};

const CATEGORY_ORDER: CheckWarning["category"][] = [
  "rule_violation",
  "duplicate_name",
  "meal_conflict",
  "similar_company",
];

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onEditGuest: (id: string) => void;
}

export function SmartChecksSheet({ open, onOpenChange, onEditGuest }: Props) {
  const guests = usePlanStore((s) => s.guests);
  const tables = usePlanStore((s) => s.tables);
  const rules = usePlanStore((s) => s.rules);

  const warnings = useMemo(
    () => runSmartChecks(guests, tables, rules),
    [guests, tables, rules]
  );

  const byCategory = useMemo(() => {
    const m = new Map<CheckWarning["category"], CheckWarning[]>();
    CATEGORY_ORDER.forEach((c) => m.set(c, []));
    warnings.forEach((w) => m.get(w.category)?.push(w));
    return m;
  }, [warnings]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <span>🔍 Smart Checks</span>
            {warnings.length > 0 && (
              <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
                {warnings.length} issue{warnings.length !== 1 ? "s" : ""}
              </span>
            )}
          </SheetTitle>
        </SheetHeader>

        {warnings.length === 0 ? (
          <div className="mt-10 text-center px-6">
            <div className="text-5xl mb-3">✅</div>
            <div className="text-lg font-semibold mb-1">All checks passed</div>
            <p className="text-sm text-muted-foreground">
              No duplicate names, company conflicts, meal issues, or rule violations found.
            </p>
          </div>
        ) : (
          <div className="mt-4 space-y-6">
            {CATEGORY_ORDER.map((cat) => {
              const items = byCategory.get(cat) ?? [];
              if (items.length === 0) return null;
              return (
                <section key={cat}>
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                    {CATEGORY_LABELS[cat]} ({items.length})
                  </h3>
                  <div className="space-y-2">
                    {items.map((w) => (
                      <div
                        key={w.id}
                        className="border border-border rounded-lg p-3 bg-card"
                      >
                        <div className="flex items-start gap-2">
                          {w.severity === "warning" ? (
                            <TriangleAlert className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                          ) : (
                            <Info className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium">{w.message}</div>
                            {w.detail && (
                              <p className="text-xs text-muted-foreground mt-1">{w.detail}</p>
                            )}
                            {w.guestIds.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-2">
                                {w.guestIds.map((id) => {
                                  const g = guests.find((x) => x.id === id);
                                  if (!g) return null;
                                  return (
                                    <button
                                      key={id}
                                      onClick={() => {
                                        onEditGuest(id);
                                        onOpenChange(false);
                                      }}
                                      className="text-[11px] px-2 py-0.5 rounded-full bg-background border border-border hover:border-foreground/40 hover:bg-accent transition"
                                    >
                                      {g.name}
                                    </button>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

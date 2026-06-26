import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { usePlanStore, type Guest } from "@/lib/plan-store";
import { runSmartChecks, type CheckWarning } from "@/lib/smart-checks";
import { useMemo, useState } from "react";
import { TriangleAlert, Info } from "lucide-react";
import { toast } from "sonner";

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

function BulkRenamePanel({
  warning,
  guests,
  updateGuest,
}: {
  warning: CheckWarning;
  guests: Guest[];
  updateGuest: (id: string, patch: Partial<Guest>) => void;
}) {
  const affectedGuests = useMemo(
    () => guests.filter((g) => warning.guestIds.includes(g.id)),
    [guests, warning.guestIds],
  );
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    () => new Set(warning.guestIds),
  );
  const [newName, setNewName] = useState("");
  const [applying, setApplying] = useState(false);

  const allSelected = selectedIds.size === affectedGuests.length;

  return (
    <div className="mt-3 p-3 rounded-lg border border-border bg-muted/30">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          Bulk rename {affectedGuests.length} guests
        </span>
        <button
          onClick={() =>
            setSelectedIds(
              allSelected ? new Set() : new Set(affectedGuests.map((g) => g.id)),
            )
          }
          className="text-xs text-primary underline-offset-2 hover:underline"
        >
          {allSelected ? "Deselect all" : "Select all"}
        </button>
      </div>

      <div className="space-y-1 mb-3">
        {affectedGuests.map((g) => (
          <label
            key={g.id}
            className="flex items-center gap-2 text-sm cursor-pointer"
          >
            <input
              type="checkbox"
              checked={selectedIds.has(g.id)}
              onChange={(e) => {
                const next = new Set(selectedIds);
                if (e.target.checked) next.add(g.id);
                else next.delete(g.id);
                setSelectedIds(next);
              }}
              className="rounded"
            />
            <span className="flex-1 truncate">{g.name}</span>
            <span className="text-xs text-muted-foreground truncate max-w-[140px]">
              {g.company}
            </span>
          </label>
        ))}
      </div>

      <div className="flex gap-2">
        <input
          type="text"
          placeholder="Type canonical company name…"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          className="flex-1 h-8 px-3 rounded-md border border-input bg-background text-sm"
        />
        <button
          disabled={!newName.trim() || selectedIds.size === 0 || applying}
          onClick={() => {
            const trimmed = newName.trim();
            if (!trimmed || selectedIds.size === 0) return;
            setApplying(true);
            Array.from(selectedIds).forEach((id) =>
              updateGuest(id, { company: trimmed }),
            );
            toast.success(
              `Company renamed to "${trimmed}" for ${selectedIds.size} guest(s)`,
            );
            setNewName("");
            setApplying(false);
          }}
          className="h-8 px-3 rounded-md bg-primary text-primary-foreground text-sm font-medium disabled:opacity-50"
        >
          Rename
        </button>
      </div>
      {selectedIds.size === 0 && (
        <p className="text-xs text-muted-foreground mt-1">
          Select at least one guest to rename.
        </p>
      )}
    </div>
  );
}

export function SmartChecksSheet({ open, onOpenChange, onEditGuest }: Props) {
  const guests = usePlanStore((s) => s.guests);
  const tables = usePlanStore((s) => s.tables);
  const rules = usePlanStore((s) => s.rules);
  const updateGuest = usePlanStore((s) => s.updateGuest);

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
                            {w.category === "similar_company" && (
                              <BulkRenamePanel
                                warning={w}
                                guests={guests}
                                updateGuest={updateGuest}
                              />
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

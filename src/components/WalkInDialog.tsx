import { useMemo, useState } from "react";
import { usePlanStore, parseRowPattern } from "@/lib/plan-store";
import { rankTablesForWalkIn } from "@/lib/walkin-suggestions";
import { STAFF_NAME_KEY } from "@/lib/plan-sync-config";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { UserPlus, Star, Accessibility } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

function getStaffName(): string {
  try {
    return window.localStorage.getItem(STAFF_NAME_KEY) ?? "";
  } catch {
    return "";
  }
}
function setStaffName(name: string) {
  try {
    window.localStorage.setItem(STAFF_NAME_KEY, name);
  } catch {}
}

export function WalkInDialog({ open, onOpenChange }: Props) {
  const tables = usePlanStore((s) => s.tables);
  const guests = usePlanStore((s) => s.guests);
  const rules = usePlanStore((s) => s.rules);
  const settings = usePlanStore((s) => s.settings);
  const floorPlan = usePlanStore((s) => s.floorPlan);
  const addGuests = usePlanStore((s) => s.addGuests);
  const assignGuest = usePlanStore((s) => s.assignGuest);

  const [name, setName] = useState("");
  const [company, setCompany] = useState("");
  const [dietary, setDietary] = useState("");
  const [isVip, setIsVip] = useState(false);
  const [isWheelchair, setIsWheelchair] = useState(false);
  const [staffDraft, setStaffDraft] = useState(() => getStaffName());
  const [staffPromptDone, setStaffPromptDone] = useState(() => !!getStaffName());

  function reset() {
    setName("");
    setCompany("");
    setDietary("");
    setIsVip(false);
    setIsWheelchair(false);
  }

  const frontRowTableIds = useMemo(() => {
    const rows = parseRowPattern(settings.rowPattern);
    if (rows.length === 0) return new Set<string>();
    const set = new Set<string>();
    tables.slice(0, rows[0]).forEach((t) => set.add(t.id));
    return set;
  }, [tables, settings.rowPattern]);

  const vipTableIds = useMemo(
    () => new Set(Object.keys(floorPlan.tableVip).filter((id) => floorPlan.tableVip[id])),
    [floorPlan.tableVip],
  );

  const suggestions = useMemo(() => {
    if (!name.trim()) return [];
    return rankTablesForWalkIn({
      candidate: {
        company: company.trim() || undefined,
        tags: [isVip ? "VIP" : "", isWheelchair ? "Wheelchair" : ""].filter(Boolean),
      },
      tables,
      guests,
      rules,
      vipTableIds,
      frontRowTableIds,
    }).slice(0, 5);
  }, [name, company, isVip, isWheelchair, tables, guests, rules, vipTableIds, frontRowTableIds]);

  function commit(tableId?: string) {
    if (!name.trim()) {
      toast.error("Name is required");
      return;
    }
    const staff = staffDraft.trim();
    if (staff) setStaffName(staff);

    const trimmedName = name.trim();
    addGuests([
      {
        name: trimmedName,
        firstName: trimmedName.split(" ")[0],
        lastName: trimmedName.split(" ").slice(1).join(" ") || undefined,
        company: company.trim() || undefined,
        meal: "None",
        tags: [isVip ? "VIP" : null, isWheelchair ? "Wheelchair" : null].filter(Boolean) as any,
        dietary: dietary.trim() || undefined,
        rsvpStatus: "Confirmed",
        source: "walk-in",
        addedAt: new Date().toISOString(),
        addedBy: staff || undefined,
      },
    ]);

    if (tableId) {
      // Find the just-added guest by name+addedAt (last one wins)
      const all = usePlanStore.getState().guests;
      const added = [...all].reverse().find((g) => g.name === trimmedName && g.source === "walk-in");
      if (added) assignGuest(added.id, tableId);
      const t = tables.find((x) => x.id === tableId);
      toast.success(`${trimmedName} seated at Table ${t?.label ?? "?"}`);
    } else {
      toast.success(`${trimmedName} added — assign a table from Unassigned`);
    }
    reset();
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) reset(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-4 w-4" /> Add walk-in guest
          </DialogTitle>
        </DialogHeader>

        {!staffPromptDone && (
          <div className="rounded-md border border-amber-300 bg-amber-50 dark:bg-amber-950/30 p-3 text-xs space-y-2">
            <div className="font-semibold text-amber-800 dark:text-amber-200">Who's adding walk-ins on this device?</div>
            <div className="flex gap-2">
              <Input
                autoFocus
                value={staffDraft}
                onChange={(e) => setStaffDraft(e.target.value)}
                placeholder="e.g. Amy (front desk)"
                className="h-8"
              />
              <button
                onClick={() => { if (staffDraft.trim()) { setStaffName(staffDraft.trim()); setStaffPromptDone(true); } }}
                className="h-8 px-3 rounded-md bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold"
              >
                Save
              </button>
            </div>
          </div>
        )}

        <div className="space-y-3">
          <div>
            <Label className="text-xs">Full name *</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} autoFocus placeholder="e.g. Alex Chen" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Company</Label>
              <Input value={company} onChange={(e) => setCompany(e.target.value)} placeholder="Optional" />
            </div>
            <div>
              <Label className="text-xs">Dietary</Label>
              <Input value={dietary} onChange={(e) => setDietary(e.target.value)} placeholder="e.g. Gluten free" />
            </div>
          </div>
          <div className="flex items-center gap-4 text-xs">
            <label className="inline-flex items-center gap-1.5 cursor-pointer">
              <input type="checkbox" checked={isVip} onChange={(e) => setIsVip(e.target.checked)} />
              <Star className="h-3.5 w-3.5 text-vip fill-current" /> VIP
            </label>
            <label className="inline-flex items-center gap-1.5 cursor-pointer">
              <input type="checkbox" checked={isWheelchair} onChange={(e) => setIsWheelchair(e.target.checked)} />
              <Accessibility className="h-3.5 w-3.5" /> Wheelchair access
            </label>
          </div>
        </div>

        {name.trim() && suggestions.length > 0 && (
          <div className="mt-2">
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold mb-1.5">
              Suggested tables · tap to seat
            </div>
            <div className="space-y-1.5 max-h-56 overflow-y-auto">
              {suggestions.map((s) => (
                <button
                  key={s.tableId}
                  onClick={() => commit(s.tableId)}
                  className="w-full text-left px-3 py-2 rounded-md border border-input hover:bg-accent hover:border-primary transition flex items-center justify-between gap-3"
                >
                  <div className="min-w-0">
                    <div className="font-medium text-sm">Table {s.tableLabel}</div>
                    <div className="text-[11px] text-muted-foreground truncate">
                      {s.reasons.join(" · ")}
                    </div>
                  </div>
                  <span className="text-[10px] font-mono text-muted-foreground shrink-0">score {s.score}</span>
                </button>
              ))}
            </div>
          </div>
        )}
        {name.trim() && suggestions.length === 0 && (
          <div className="text-xs text-muted-foreground italic mt-2">
            No tables with open seats. Add to Unassigned and free up a seat elsewhere first.
          </div>
        )}

        <DialogFooter>
          <button
            onClick={() => onOpenChange(false)}
            className="h-9 px-3 rounded-md border border-input text-sm"
          >
            Cancel
          </button>
          <button
            onClick={() => commit(undefined)}
            disabled={!name.trim()}
            className="h-9 px-3 rounded-md border border-input text-sm hover:bg-accent disabled:opacity-40"
          >
            Add to Unassigned
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

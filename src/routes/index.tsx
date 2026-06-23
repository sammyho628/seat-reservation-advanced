import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { PlannerGrid } from "@/components/PlannerGrid";
import { UnassignedPanel } from "@/components/UnassignedPanel";
import { usePlanStore } from "@/lib/plan-store";
import { toast } from "sonner";
import { Wand2, RotateCcw, Download, Settings as SettingsIcon } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

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

function PlannerPage() {
  const [selectedGuestId, setSelectedGuestId] = useState<string | null>(null);
  const settings = usePlanStore((s) => s.settings);
  const setSettings = usePlanStore((s) => s.setSettings);
  const autoSeat = usePlanStore((s) => s.autoSeat);
  const resetAssignments = usePlanStore((s) => s.resetAssignments);
  const guests = usePlanStore((s) => s.guests);
  const tables = usePlanStore((s) => s.tables);
  const importPlan = usePlanStore((s) => s.importPlan);

  function handleAuto() {
    if (guests.length === 0) {
      toast.error("Add or import guests first.");
      return;
    }
    const r = autoSeat();
    toast.success(`Seated ${r.assigned} of ${guests.length}`, {
      description: r.violations
        ? `${r.violations} soft constraint violation(s).`
        : "No constraint violations.",
    });
  }

  function exportJSON() {
    const blob = new Blob(
      [JSON.stringify({ settings, tables, guests, rules: usePlanStore.getState().rules }, null, 2)],
      { type: "application/json" },
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${settings.eventTitle.replace(/\s+/g, "-").toLowerCase()}-plan.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function importJSON(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    try {
      const data = JSON.parse(await f.text());
      importPlan(data);
      toast.success("Plan imported");
    } catch {
      toast.error("Invalid plan file");
    }
  }

  return (
    <AppShell>
      <div className="flex">
        <div className="flex-1 min-w-0">
          <div className="max-w-[1300px] mx-auto px-6 py-8">
            {/* Toolbar */}
            <div className="flex flex-wrap items-end gap-4 mb-8 pb-6 border-b border-border/60">
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
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Event settings</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div>
                        <Label>Event title</Label>
                        <Input
                          value={settings.eventTitle}
                          onChange={(e) => setSettings({ eventTitle: e.target.value })}
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <Label>Show stage marker</Label>
                        <Switch
                          checked={settings.showStage}
                          onCheckedChange={(v) => setSettings({ showStage: v })}
                        />
                      </div>
                      <div className="pt-2 border-t border-border space-y-2">
                        <div className="flex gap-2">
                          <button
                            onClick={exportJSON}
                            className="flex-1 h-9 rounded-md border border-input text-sm inline-flex items-center justify-center gap-1.5"
                          >
                            <Download className="h-4 w-4" /> Export plan
                          </button>
                          <label className="flex-1 h-9 rounded-md border border-input text-sm inline-flex items-center justify-center gap-1.5 cursor-pointer">
                            Import plan
                            <input type="file" accept=".json" className="hidden" onChange={importJSON} />
                          </label>
                        </div>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={resetAssignments}
                  className="h-10 px-3 rounded-md border border-input text-sm inline-flex items-center gap-1.5 hover:bg-accent"
                >
                  <RotateCcw className="h-4 w-4" /> Clear seats
                </button>
                <button
                  onClick={handleAuto}
                  className="h-10 px-4 rounded-md bg-primary text-primary-foreground text-sm inline-flex items-center gap-1.5 hover:opacity-90"
                >
                  <Wand2 className="h-4 w-4" /> Auto-seat
                </button>
              </div>
            </div>

            <p className="text-xs text-muted-foreground mb-4">
              Click a seat to select it · click another seat to swap · select an unassigned guest, then click an empty seat to place them · click a table name to rename.
            </p>

            <PlannerGrid
              selectedGuestId={selectedGuestId}
              onAfterAssign={() => setSelectedGuestId(null)}
            />
          </div>
        </div>
        <UnassignedPanel selectedGuestId={selectedGuestId} onSelect={setSelectedGuestId} />
      </div>
    </AppShell>
  );
}

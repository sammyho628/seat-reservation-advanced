import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { usePlanStore } from "@/lib/plan-store";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Upload } from "lucide-react";
import {
  parseFileRows,
  detectColumnMap,
  rowsToGuestsWithMap,
} from "@/lib/import-export";

export function WelcomeGate() {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [hasExisting, setHasExisting] = useState(false);
  const setSettings = usePlanStore((s) => s.setSettings);
  const importPlan = usePlanStore((s) => s.importPlan);
  const addGuests = usePlanStore((s) => s.addGuests);
  const navigate = useNavigate();

  useEffect(() => {
    try {
      const welcomed = window.localStorage.getItem("seatcraft-welcomed");
      const existing = window.localStorage.getItem("seating-plan-v2");
      setHasExisting(!!existing);
      if (!welcomed) setOpen(true);
    } catch {}
  }, []);

  function finish() {
    try { window.localStorage.setItem("seatcraft-welcomed", "1"); } catch {}
    setOpen(false);
  }

  function startNew() {
    if (title.trim()) setSettings({ eventTitle: title.trim() });
    finish();
  }

  async function loadFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    try {
      const data = JSON.parse(await f.text());
      if (importPlan(data)) {
        toast.success("Plan loaded");
        finish();
      } else toast.error("Invalid plan file");
    } catch {
      toast.error("Could not read file");
    }
  }

  async function importCsv(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    try {
      if (title.trim()) setSettings({ eventTitle: title.trim() });
      const { rows, headers } = await parseFileRows(f);
      const drafts = rowsToGuestsWithMap(rows, detectColumnMap(headers));
      if (drafts.length === 0) {
        toast.error("No guests found in file");
        return;
      }
      addGuests(drafts);
      toast.success(`Imported ${drafts.length} guests`);
      finish();
      navigate({ to: "/guests" });
    } catch {
      toast.error("Could not parse file");
    } finally {
      e.target.value = "";
    }
  }

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent className="max-w-lg [&>button]:hidden">
        <div className="text-center py-4">
          <div className="font-display text-5xl mb-2">Seatcraft</div>
          <p className="text-muted-foreground text-sm mb-6">
            Professional event seating, entirely in your browser.
          </p>
          <div className="space-y-3 text-left">
            <Input
              autoFocus
              placeholder="e.g. Annual Gala 2026"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && startNew()}
            />
            <button
              onClick={startNew}
              className="w-full h-11 rounded-md bg-primary text-primary-foreground font-medium"
            >
              Start a new event
            </button>
            <label className="block w-full h-11 rounded-md border border-input text-sm inline-flex items-center justify-center gap-2 cursor-pointer hover:bg-accent">
              <Upload className="h-4 w-4" />
              Import guest list — CSV or Excel
              <input type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={importCsv} />
            </label>
            <label className="block w-full text-center text-xs text-muted-foreground hover:text-foreground cursor-pointer pt-1">
              Returning? Load a saved plan (.json)
              <input type="file" accept=".json" className="hidden" onChange={loadFile} />
            </label>
            {hasExisting && (
              <button onClick={finish} className="w-full text-[11px] text-muted-foreground/70 hover:text-foreground">
                Continue with current plan
              </button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

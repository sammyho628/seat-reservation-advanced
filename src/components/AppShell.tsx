import { Link, useRouterState } from "@tanstack/react-router";
import { LayoutGrid, Users, Sliders, Printer, UserCheck, MoreVertical, Plus, Copy, Download, Upload, RotateCcw, ListFilter } from "lucide-react";
import { usePlanStore } from "@/lib/plan-store";
import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

const nav = [
  { to: "/", label: "Planner", icon: LayoutGrid },
  { to: "/guests", label: "Guests", icon: Users },
  { to: "/rules", label: "Rules", icon: Sliders },
  { to: "/checkin", label: "Check-in", icon: UserCheck },
  { to: "/print", label: "Print", icon: Printer },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const eventTitle = usePlanStore((s) => s.settings.eventTitle);
  const logoDataUrl = usePlanStore((s) => s.settings.logoDataUrl);
  const allGuests = usePlanStore((s) => s.guests);
  const guestCount = allGuests.length;
  const unassigned = allGuests.filter((g) => !g.tableId && g.rsvpStatus !== "Declined" && g.rsvpStatus !== "No-show").length;
  const importPlan = usePlanStore((s) => s.importPlan);
  const resetAssignments = usePlanStore((s) => s.resetAssignments);

  const [savedFlash, setSavedFlash] = useState(false);
  const [dupOpen, setDupOpen] = useState(false);
  const [dupTitle, setDupTitle] = useState("");
  const importRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const off = (window as any).__seatcraftOnSave?.((_t: number) => {
      setSavedFlash(true);
      setTimeout(() => setSavedFlash(false), 1800);
    });
    return () => off?.();
  }, []);

  function exportJSON() {
    const s = usePlanStore.getState();
    const blob = new Blob(
      [JSON.stringify({ settings: s.settings, tables: s.tables, guests: s.guests, rules: s.rules }, null, 2)],
      { type: "application/json" },
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${s.settings.eventTitle.replace(/\s+/g, "-").toLowerCase()}-plan.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function importJSON(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    try {
      const data = JSON.parse(await f.text());
      const ok = importPlan(data);
      if (ok) toast.success("Plan imported");
      else toast.error("Invalid plan file shape");
    } catch {
      toast.error("Could not read file");
    } finally {
      e.target.value = "";
    }
  }

  function newPlan() {
    if (!confirm("Start a new plan? Current plan will be cleared.")) return;
    try {
      window.localStorage.removeItem("seating-plan-v2");
      window.localStorage.removeItem("seatcraft-welcomed");
    } catch {}
    window.location.reload();
  }

  function doDuplicate() {
    const s = usePlanStore.getState();
    const title = dupTitle.trim() || `${s.settings.eventTitle} (copy)`;
    importPlan({ ...s, settings: { ...s.settings, eventTitle: title } });
    setDupOpen(false);
    setDupTitle("");
    toast.success(`Duplicated as "${title}"`);
  }

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      <header className="no-print border-b border-border/70 bg-background/80 backdrop-blur sticky top-0 z-30">
        <div className="max-w-[1600px] mx-auto px-6 h-16 flex items-center gap-8">
          <Link to="/" className="flex items-center gap-2">
            {logoDataUrl && <img src={logoDataUrl} alt="" className="h-8 w-auto rounded" />}
            <span className="font-display text-2xl">Seatcraft</span>
            <span className="text-muted-foreground text-sm hidden sm:inline">· {eventTitle}</span>
          </Link>
          <nav className="flex items-center gap-1 ml-4">
            {nav.map((item) => {
              const active = pathname === item.to;
              const Icon = item.icon;
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={`px-3 py-2 text-sm rounded-md flex items-center gap-2 transition-colors ${
                    active
                      ? "bg-primary text-primary-foreground"
                      : "text-foreground/70 hover:bg-accent hover:text-foreground"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
          <div className="ml-auto flex items-center gap-3 text-xs text-muted-foreground">
            <span
              className={`font-mono transition-opacity duration-500 ${savedFlash ? "opacity-100 text-emerald-600" : "opacity-0"}`}
            >
              Saved ✓
            </span>
            <span className="font-mono">{guestCount} guests</span>
            <span className="opacity-50">·</span>
            <span className="font-mono">
              {unassigned > 0 ? (
                <span className="text-destructive">{unassigned} unassigned</span>
              ) : (
                "all seated"
              )}
            </span>
            <DropdownMenu>
              <DropdownMenuTrigger className="ml-2 h-8 w-8 inline-flex items-center justify-center rounded-md hover:bg-accent">
                <MoreVertical className="h-4 w-4" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuItem onClick={newPlan}>
                  <Plus className="h-4 w-4 mr-2" /> New plan
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => {
                    setDupTitle(`${usePlanStore.getState().settings.eventTitle} (copy)`);
                    setDupOpen(true);
                  }}
                >
                  <Copy className="h-4 w-4 mr-2" /> Duplicate plan
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={exportJSON}>
                  <Download className="h-4 w-4 mr-2" /> Export JSON
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => importRef.current?.click()}>
                  <Upload className="h-4 w-4 mr-2" /> Import JSON
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => { resetAssignments(); toast.success("Cleared seat assignments"); }}>
                  <RotateCcw className="h-4 w-4 mr-2" /> Reset assignments
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <input ref={importRef} type="file" accept=".json" className="hidden" onChange={importJSON} />
          </div>
        </div>
      </header>
      <main className="flex-1">{children}</main>

      <Dialog open={dupOpen} onOpenChange={setDupOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Duplicate plan</DialogTitle>
          </DialogHeader>
          <Input value={dupTitle} onChange={(e) => setDupTitle(e.target.value)} placeholder="New event title" autoFocus />
          <DialogFooter>
            <button onClick={() => setDupOpen(false)} className="h-9 px-3 rounded-md border border-input text-sm">Cancel</button>
            <button onClick={doDuplicate} className="h-9 px-3 rounded-md bg-primary text-primary-foreground text-sm">Duplicate</button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

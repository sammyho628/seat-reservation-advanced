import { Link, useRouterState } from "@tanstack/react-router";
import { LayoutGrid, Users, Printer, UserCheck, MoreVertical, Copy } from "lucide-react";
import { usePlanStore } from "@/lib/plan-store";
import { useEffect, useState, type ReactNode } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
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
  { to: "/checkin", label: "Check-in", icon: UserCheck },
  { to: "/print", label: "Print", icon: Printer },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const eventTitle = usePlanStore((s) => s.settings.eventTitle);
  const eventDate = usePlanStore((s) => s.settings.eventDate);
  const eventVenue = usePlanStore((s) => s.settings.eventVenue);
  const eventTime = usePlanStore((s) => s.settings.eventTime);
  const logoDataUrl = usePlanStore((s) => s.settings.logoDataUrl);
  const allGuests = usePlanStore((s) => s.guests);
  const guestCount = allGuests.filter((g) => !g.isPlaceholder).length;
  const unassigned = allGuests.filter((g) => !g.tableId && !g.isPlaceholder && g.rsvpStatus !== "Declined" && g.rsvpStatus !== "No-show" && g.rsvpStatus !== "Withdrawn").length;
  const tbcCount = allGuests.filter((g) => g.isPlaceholder).length;
  const importPlan = usePlanStore((s) => s.importPlan);

  const [savedFlash, setSavedFlash] = useState(false);
  const [dupOpen, setDupOpen] = useState(false);
  const [dupTitle, setDupTitle] = useState("");

  useEffect(() => {
    const off = (window as any).__seatcraftOnSave?.((_t: number) => {
      setSavedFlash(true);
      setTimeout(() => setSavedFlash(false), 1800);
    });
    return () => off?.();
  }, []);

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
            <span className="text-muted-foreground text-sm hidden sm:inline">
              · {eventTitle}
              {eventDate && (
                <span className="ml-1 opacity-60">
                  {new Date(eventDate + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                </span>
              )}
              {eventVenue && <span className="ml-1 opacity-60">· {eventVenue}</span>}
            </span>
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
            {tbcCount > 0 && (
              <>
                <span className="opacity-50">·</span>
                <span className="font-mono text-indigo-600 font-semibold">{tbcCount} TBC</span>
              </>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger className="ml-2 h-8 w-8 inline-flex items-center justify-center rounded-md hover:bg-accent">
                <MoreVertical className="h-4 w-4" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuItem
                  onClick={() => {
                    setDupTitle(`${usePlanStore.getState().settings.eventTitle} (copy)`);
                    setDupOpen(true);
                  }}
                >
                  <Copy className="h-4 w-4 mr-2" /> Duplicate plan
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
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

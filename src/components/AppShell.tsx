import { Link, useRouterState } from "@tanstack/react-router";
import { LayoutGrid, Users, Sliders, Printer } from "lucide-react";
import { usePlanStore } from "@/lib/plan-store";
import type { ReactNode } from "react";

const nav = [
  { to: "/", label: "Planner", icon: LayoutGrid },
  { to: "/guests", label: "Guests", icon: Users },
  { to: "/rules", label: "Rules", icon: Sliders },
  { to: "/print", label: "Print", icon: Printer },
];

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const eventTitle = usePlanStore((s) => s.settings.eventTitle);
  const allGuests = usePlanStore((s) => s.guests);
  const guestCount = allGuests.length;
  const unassigned = allGuests.filter((g) => !g.tableId).length;

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      <header className="no-print border-b border-border/70 bg-background/80 backdrop-blur sticky top-0 z-30">
        <div className="max-w-[1600px] mx-auto px-6 h-16 flex items-center gap-8">
          <Link to="/" className="flex items-baseline gap-2">
            <span className="font-display text-2xl">Seatcraft</span>
            <span className="text-muted-foreground text-sm hidden sm:inline">
              · {eventTitle}
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
            <span className="font-mono">{guestCount} guests</span>
            <span className="opacity-50">·</span>
            <span className="font-mono">
              {unassigned > 0 ? (
                <span className="text-destructive">{unassigned} unassigned</span>
              ) : (
                "all seated"
              )}
            </span>
          </div>
        </div>
      </header>
      <main className="flex-1">{children}</main>
    </div>
  );
}

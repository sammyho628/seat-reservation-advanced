import { useEffect, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { usePlanStore, type Meal, type RsvpStatus, type Tag } from "@/lib/plan-store";
import { toast } from "sonner";

const MEALS: Meal[] = ["None", "Chicken", "Fish", "Vegetarian", "Vegan", "Kids"];
const RSVPS: RsvpStatus[] = ["Confirmed", "Pending", "Declined", "Waitlist", "No-show", "Withdrawn"];
const TAGS: Tag[] = ["VIP", "Wheelchair", "Child", "Speaker", "Sponsor"];

type Draft = {
  name: string;
  firstName: string;
  lastName: string;
  company: string;
  title: string;
  cohort: string;
  dietary: string;
  notes: string;
};

const EMPTY: Draft = { name: "", firstName: "", lastName: "", company: "", title: "", cohort: "", dietary: "", notes: "" };

export function GuestEditSheet({ guestId, onClose }: { guestId: string | null; onClose: () => void }) {
  const guest = usePlanStore((s) => s.guests.find((g) => g.id === guestId));
  const updateGuest = usePlanStore((s) => s.updateGuest);
  const tables = usePlanStore((s) => s.tables);
  const guests = usePlanStore((s) => s.guests);
  const unassignGuest = usePlanStore((s) => s.unassignGuest);
  const removeGuest = usePlanStore((s) => s.removeGuest);
  const assignGuest = usePlanStore((s) => s.assignGuest);

  const open = !!guestId && !!guest;
  const table = guest ? tables.find((t) => t.id === guest.tableId) : null;

  const [draft, setDraft] = useState<Draft>(EMPTY);

  useEffect(() => {
    if (guest) {
      setDraft({
        name: guest.name ?? "",
        firstName: guest.firstName ?? "",
        lastName: guest.lastName ?? "",
        company: guest.company ?? "",
        title: guest.title ?? "",
        cohort: guest.cohort ?? "",
        dietary: guest.dietary ?? "",
        notes: guest.notes ?? "",
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [guest?.id]);

  function field(label: string, content: React.ReactNode) {
    return (
      <div>
        <label className="text-xs uppercase tracking-wider text-muted-foreground block mb-1">{label}</label>
        {content}
      </div>
    );
  }

  const cls = "w-full h-9 px-3 rounded-md border border-input bg-background text-sm";

  function flush<K extends keyof Draft>(key: K, opts?: { isName?: boolean }) {
    if (!guest) return;
    const value = draft[key];
    if (opts?.isName) {
      const newName = value;
      const stillTbc = newName.trim() === "" || newName.trim().toUpperCase().startsWith("TBC");
      updateGuest(guest.id, { name: newName, isPlaceholder: stillTbc ? true : undefined });
      return;
    }
    updateGuest(guest.id, { [key]: value || undefined } as any);
  }

  return (
    <Sheet open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
        {guest && (
          <>
            <SheetHeader>
              <SheetTitle>{guest.name || "(unnamed)"}</SheetTitle>
              {table && (
                <div className="text-xs text-muted-foreground">
                  Table {table.label} · Seat {guest.seatIndex}
                  <button onClick={() => unassignGuest(guest.id)} className="ml-2 text-xs text-destructive hover:underline">
                    Unassign
                  </button>
                </div>
              )}
            </SheetHeader>

            <div className="space-y-4 mt-4 pb-12">
              {guest.isPlaceholder && (
                <div className="rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 px-4 py-3">
                  <div className="text-xs font-bold text-amber-700 dark:text-amber-400 uppercase tracking-wider mb-1">
                    TBC — awaiting real name
                  </div>
                  <p className="text-xs text-amber-700/80 dark:text-amber-400/80">
                    {guest.company ? `Reserved for ${guest.company}. ` : ""}
                    Assign an unassigned guest to this seat to fill it, or type a name below to convert directly.
                  </p>
                </div>
              )}
              {field("Full name", (
                <input
                  value={draft.name}
                  onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
                  onBlur={() => flush("name", { isName: true })}
                  className={cls}
                />
              ))}
              {field("First name", (
                <input
                  value={draft.firstName}
                  onChange={(e) => setDraft((d) => ({ ...d, firstName: e.target.value }))}
                  onBlur={() => flush("firstName")}
                  placeholder="—"
                  className={cls}
                />
              ))}
              {field("Last name", (
                <input
                  value={draft.lastName}
                  onChange={(e) => setDraft((d) => ({ ...d, lastName: e.target.value }))}
                  onBlur={() => flush("lastName")}
                  placeholder="—"
                  className={cls}
                />
              ))}
              {field("Company", (
                <input
                  value={draft.company}
                  onChange={(e) => setDraft((d) => ({ ...d, company: e.target.value }))}
                  onBlur={() => flush("company")}
                  placeholder="—"
                  className={cls}
                />
              ))}
              {field("Title", (
                <input
                  value={draft.title}
                  onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
                  onBlur={() => flush("title")}
                  placeholder="—"
                  className={cls}
                />
              ))}
              {field("Cohort", (
                <input
                  value={draft.cohort}
                  onChange={(e) => setDraft((d) => ({ ...d, cohort: e.target.value }))}
                  onBlur={() => flush("cohort")}
                  placeholder="—"
                  className={cls}
                />
              ))}
              {field("Meal", (
                <select value={guest.meal} onChange={(e) => updateGuest(guest.id, { meal: e.target.value as Meal })} className={cls}>
                  {MEALS.map((m) => <option key={m} value={m}>{m}</option>)}
                </select>
              ))}
              {field("Dietary requirements", (
                <input
                  value={draft.dietary}
                  onChange={(e) => setDraft((d) => ({ ...d, dietary: e.target.value }))}
                  onBlur={() => flush("dietary")}
                  placeholder="Allergies, restrictions…"
                  className={cls}
                />
              ))}
              {field("RSVP", (
                <select value={guest.rsvpStatus} onChange={(e) => updateGuest(guest.id, { rsvpStatus: e.target.value as RsvpStatus })} className={cls}>
                  {RSVPS.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              ))}
              {field("Notes", (
                <textarea
                  value={draft.notes}
                  onChange={(e) => setDraft((d) => ({ ...d, notes: e.target.value }))}
                  onBlur={() => flush("notes")}
                  placeholder="Any notes…"
                  rows={3}
                  className="w-full px-3 py-2 rounded-md border border-input bg-background text-sm resize-none"
                />
              ))}
              {field("Tags", (
                <div className="flex flex-wrap gap-1.5">
                  {TAGS.map((t) => {
                    const on = guest.tags.includes(t);
                    return (
                      <button
                        key={t}
                        onClick={() => updateGuest(guest.id, { tags: on ? guest.tags.filter((x) => x !== t) : [...guest.tags, t] })}
                        className={`text-xs px-2.5 py-1 rounded-full border transition ${on ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:border-foreground/40"}`}
                      >
                        {t}
                      </button>
                    );
                  })}
                </div>
              ))}
              {field("Lock seat", (
                <button
                  onClick={() => updateGuest(guest.id, { locked: !guest.locked })}
                  disabled={!guest.tableId}
                  className={`text-sm px-3 py-1.5 rounded-md border ${guest.locked ? "bg-amber-50 border-amber-300 text-amber-700" : "border-input text-muted-foreground"} disabled:opacity-30`}
                >
                  {guest.locked ? "🔒 Locked to seat" : "○ Not locked"}
                </button>
              ))}
              {guest.tableId && field("Move to seat", (
                <div className="flex gap-2">
                  <select
                    className="flex-1 h-9 rounded-md border border-input bg-background px-2 text-sm"
                    value=""
                    onChange={(e) => {
                      const [tableId, seatStr] = e.target.value.split("::");
                      if (!tableId) return;
                      const seatIndex = seatStr ? parseInt(seatStr) : undefined;
                      assignGuest(guest.id, tableId, seatIndex || undefined);
                      toast.success(`Moved to Table ${tables.find((t) => t.id === tableId)?.label}`);
                    }}
                  >
                    <option value="">— select destination —</option>
                    {tables.map((t) => {
                      const occupiedSeats = new Set(
                        guests.filter((g) => g.tableId === t.id && g.id !== guest.id).map((g) => g.seatIndex)
                      );
                      const emptySeats = Array.from({ length: t.seats }, (_, i) => i + 1).filter((s) => !occupiedSeats.has(s));
                      if (emptySeats.length === 0) return null;
                      return (
                        <optgroup key={t.id} label={`Table ${t.label} (${emptySeats.length} free)`}>
                          {emptySeats.map((s) => (
                            <option key={s} value={`${t.id}::${s}`}>Table {t.label} · Seat {s}</option>
                          ))}
                        </optgroup>
                      );
                    })}
                  </select>
                </div>
              ))}
              <div className="pt-4 border-t border-border mt-2">
                <button
                  onClick={() => {
                    if (window.confirm(`Delete ${guest.name} from the plan? This cannot be undone.`)) {
                      removeGuest(guest.id);
                      onClose();
                      toast.success(`${guest.name} removed from plan`);
                    }
                  }}
                  className="w-full h-9 rounded-md border border-destructive/40 text-destructive text-sm hover:bg-destructive/5 transition"
                >
                  Delete guest from plan
                </button>
              </div>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

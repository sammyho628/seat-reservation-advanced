import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { usePlanStore, type Meal, type RsvpStatus, type Tag } from "@/lib/plan-store";

const MEALS: Meal[] = ["None", "Chicken", "Fish", "Vegetarian", "Vegan", "Kids"];
const RSVPS: RsvpStatus[] = ["Confirmed", "Pending", "Declined", "Waitlist", "No-show", "Withdrawn"];
const TAGS: Tag[] = ["VIP", "Wheelchair", "Child", "Speaker", "Sponsor"];

export function GuestEditSheet({ guestId, onClose }: { guestId: string | null; onClose: () => void }) {
  const guest = usePlanStore((s) => s.guests.find((g) => g.id === guestId));
  const updateGuest = usePlanStore((s) => s.updateGuest);
  const tables = usePlanStore((s) => s.tables);
  const unassignGuest = usePlanStore((s) => s.unassignGuest);

  const open = !!guestId && !!guest;
  const table = guest ? tables.find((t) => t.id === guest.tableId) : null;

  function field(label: string, content: React.ReactNode) {
    return (
      <div>
        <label className="text-xs uppercase tracking-wider text-muted-foreground block mb-1">{label}</label>
        {content}
      </div>
    );
  }

  const cls = "w-full h-9 px-3 rounded-md border border-input bg-background text-sm";

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
              {field("Full name", <input value={guest.name} onChange={(e) => {
                const newName = e.target.value;
                const stillTbc = newName.trim() === "" || newName.trim().toUpperCase().startsWith("TBC");
                updateGuest(guest.id, { name: newName, isPlaceholder: stillTbc ? true : undefined });
              }} className={cls} />)}
              {field("First name", <input value={guest.firstName ?? ""} onChange={(e) => updateGuest(guest.id, { firstName: e.target.value || undefined })} placeholder="—" className={cls} />)}
              {field("Last name", <input value={guest.lastName ?? ""} onChange={(e) => updateGuest(guest.id, { lastName: e.target.value || undefined })} placeholder="—" className={cls} />)}
              {field("Company", <input value={guest.company ?? ""} onChange={(e) => updateGuest(guest.id, { company: e.target.value || undefined })} placeholder="—" className={cls} />)}
              {field("Title", <input value={guest.title ?? ""} onChange={(e) => updateGuest(guest.id, { title: e.target.value || undefined })} placeholder="—" className={cls} />)}
              {field("Cohort", <input value={guest.cohort ?? ""} onChange={(e) => updateGuest(guest.id, { cohort: e.target.value || undefined })} placeholder="—" className={cls} />)}
              {field("Meal", (
                <select value={guest.meal} onChange={(e) => updateGuest(guest.id, { meal: e.target.value as Meal })} className={cls}>
                  {MEALS.map((m) => <option key={m} value={m}>{m}</option>)}
                </select>
              ))}
              {field("Dietary requirements", <input value={guest.dietary ?? ""} onChange={(e) => updateGuest(guest.id, { dietary: e.target.value || undefined })} placeholder="Allergies, restrictions…" className={cls} />)}
              {field("RSVP", (
                <select value={guest.rsvpStatus} onChange={(e) => updateGuest(guest.id, { rsvpStatus: e.target.value as RsvpStatus })} className={cls}>
                  {RSVPS.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              ))}
              {field("Notes", <textarea value={guest.notes ?? ""} onChange={(e) => updateGuest(guest.id, { notes: e.target.value || undefined })} placeholder="Any notes…" rows={3} className="w-full px-3 py-2 rounded-md border border-input bg-background text-sm resize-none" />)}
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
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

import { useRef, useState } from "react";
import { usePlanStore, type Table, type Guest } from "@/lib/plan-store";
import {
  Star, Accessibility, TriangleAlert, RotateCw, RotateCcw,
  Pencil, Maximize2, X, Camera,
} from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

const MEAL_EMOJI: Record<string, string> = {
  Chicken: "🍗",
  Fish: "🐟",
  Vegetarian: "🥦",
  Vegan: "🌱",
  Kids: "👶",
};

interface Props {
  table: Table;
  guests: Guest[];
  selectedSeat: { tableId: string; seatIndex: number } | null;
  onSelectSeat: (sel: { tableId: string; seatIndex: number } | null) => void;
  selectedGuestId?: string | null;
  onAssignGuest?: (tableId: string, seatIndex: number) => void;
  highlighted?: boolean;
  violatingGuestIds?: Set<string>;
  cohortColorMap?: Map<string, string>;
  seatLabelMode?: "none" | "name" | "name+firm";
  showFirmInList?: boolean;
  zoomed?: boolean;
  onEditGuest?: (id: string) => void;
}

export function TableCircle(props: Props) {
  const [zoomOpen, setZoomOpen] = useState(false);
  if (props.zoomed) {
    return <TableCircleInner {...props} />;
  }
  return (
    <>
      <TableCircleInner {...props} onRequestZoom={() => setZoomOpen(true)} />
      <Dialog open={zoomOpen} onOpenChange={setZoomOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Table {props.table.label}</DialogTitle>
          </DialogHeader>
          <div className="mt-2">
            <TableCircleInner {...props} zoomed seatLabelMode="name" />
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function TableCircleInner({
  table,
  guests,
  selectedSeat,
  onSelectSeat,
  selectedGuestId,
  onAssignGuest,
  highlighted,
  violatingGuestIds,
  cohortColorMap,
  seatLabelMode = "none",
  showFirmInList = false,
  zoomed = false,
  onEditGuest,
  onRequestZoom,
}: Props & { onRequestZoom?: () => void }) {
  const updateTable = usePlanStore((s) => s.updateTable);
  const unassignGuest = usePlanStore((s) => s.unassignGuest);
  const updateGuest = usePlanStore((s) => s.updateGuest);
  const setTableHost = usePlanStore((s) => s.setTableHost);
  const rotateTable = usePlanStore((s) => s.rotateTable);
  const removeTable = usePlanStore((s) => s.removeTable);
  const checkSeatReduction = usePlanStore((s) => s.checkSeatReduction);
  const reduceTableSeats = usePlanStore((s) => s.reduceTableSeats);

  const [popoverOpen, setPopoverOpen] = useState(false);
  const [editingSeats, setEditingSeats] = useState(false);
  const [rotateOpen, setRotateOpen] = useState(false);
  const [rotateDir, setRotateDir] = useState<"cw" | "ccw">("cw");
  const [seatReductionPending, setSeatReductionPending] = useState<{ tableId: string; newSeats: number; overflowGuests: Guest[] } | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  async function downloadTablePNG() {
    if (!cardRef.current) return;
    try {
      const domtoimage = (await import("dom-to-image-more")).default;
      const blob = await domtoimage.toBlob(cardRef.current, { scale: 2 });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `table-${table.label.replace(/\s+/g, "-").toLowerCase()}.png`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error("Table PNG export failed", e);
    }
  }

  const seatMap = new Map<number, Guest>();
  guests.forEach((g) => {
    if (g.seatIndex && g.rsvpStatus !== "Declined" && g.rsvpStatus !== "No-show") {
      seatMap.set(g.seatIndex, g);
    }
  });

  const occupied = seatMap.size;
  const hasVip = guests.some((g) => g.tags.includes("VIP"));
  const hasAcc = guests.some((g) => g.tags.includes("Wheelchair"));
  const hasViolation = !!violatingGuestIds && guests.some((g) => violatingGuestIds.has(g.id));
  const dietList = guests.filter((g) => g.dietary && g.dietary.trim());
  const isEmpty = occupied === 0;

  function handleSeatClick(seatIndex: number) {
    if (selectedGuestId && !seatMap.get(seatIndex)) {
      onAssignGuest?.(table.id, seatIndex);
      return;
    }
    if (selectedSeat?.tableId === table.id && selectedSeat.seatIndex === seatIndex) {
      onSelectSeat(null);
      return;
    }
    onSelectSeat({ tableId: table.id, seatIndex });
  }

  function requestRotate(dir: "cw" | "ccw") {
    setRotateDir(dir);
    setRotateOpen(true);
  }

  const isLabelMode = seatLabelMode !== "none";
  const viewSize = isLabelMode ? 320 : 240;
  const cx = viewSize / 2;
  const cy = viewSize / 2;
  const radius = Math.min(isLabelMode ? 130 : 105, (isLabelMode ? 75 : 60) + table.seats * 4);
  const seatOffset = table.seatOffset ?? 0;

  const seats = Array.from({ length: table.seats }, (_, i) => i + 1);

  return (
    <div
      ref={cardRef}
      className={`relative rounded-xl border bg-card p-3 group transition-shadow ${
        highlighted ? "ring-2 ring-primary animate-pulse border-primary" : "border-table-ring"
      } ${zoomed ? "scale-100" : ""}`}
    >
      <div className="flex items-center justify-between mb-1 px-1">
        <div className="flex items-center gap-1 group/label flex-1 min-w-0">
          <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
            <PopoverTrigger asChild>
              <button className="font-display text-sm tracking-wider hover:underline text-left">
                TABLE {table.label}
                {(() => {
                  const hostGuest = table.hostGuestId
                    ? guests.find((g) => g.id === table.hostGuestId)
                    : null;
                  if (hostGuest) {
                    return (
                      <span className="flex items-center gap-1 mt-0.5">
                        <span className="text-[10px] bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 px-1.5 py-0.5 rounded-full font-sans font-medium tracking-normal not-italic truncate max-w-[100px]">
                          ♛ {hostGuest.name}
                        </span>
                      </span>
                    );
                  }
                  if (table.hostName) {
                    return (
                      <span className="block text-[10px] text-muted-foreground italic font-sans tracking-normal truncate">
                        {table.hostName}
                      </span>
                    );
                  }
                  return null;
                })()}
              </button>
            </PopoverTrigger>

            <PopoverContent className="w-72 space-y-3" align="start">
              <div>
                <Label className="text-xs">Label</Label>
                <Input
                  defaultValue={table.label}
                  onBlur={(e) => {
                    const newLabel = e.target.value.slice(0, 12);
                    if (newLabel && newLabel !== table.label) {
                      updateTable(table.id, { label: newLabel, customLabel: true });
                    }
                  }}
                />
              </div>
              <div>
                <Label className="text-xs">Seats</Label>
                <Input
                  type="number"
                  min={2}
                  max={24}
                  defaultValue={table.seats}
                  onBlur={(e) => {
                    const newSeats = Math.max(2, parseInt(e.target.value) || table.seats);
                    if (newSeats < table.seats) {
                      const { overflowGuests } = checkSeatReduction(table.id, newSeats);
                      if (overflowGuests.length > 0) {
                        setPopoverOpen(false);
                        setSeatReductionPending({ tableId: table.id, newSeats, overflowGuests });
                        return;
                      }
                    }
                    updateTable(table.id, { seats: newSeats });
                  }}
                />
              </div>
              <div>
                <Label className="text-xs">Start seat (visual position of seat 1)</Label>
                <div className="flex items-center gap-2 mt-1">
                  <input
                    type="range"
                    min={0}
                    max={table.seats - 1}
                    value={table.seatOffset ?? 0}
                    onChange={(e) => updateTable(table.id, { seatOffset: parseInt(e.target.value) })}
                    className="flex-1"
                  />
                  <span className="text-xs font-mono w-5 text-right">{table.seatOffset ?? 0}</span>
                </div>
              </div>
              <div>
                <Label className="text-xs">Host guest</Label>
                <select
                  className="w-full h-9 rounded-md border border-input bg-background px-2 text-sm"
                  value={table.hostGuestId ?? ""}
                  onChange={(e) => setTableHost(table.id, e.target.value || undefined)}
                >
                  <option value="">— none —</option>
                  {guests.map((g) => (
                    <option key={g.id} value={g.id}>{g.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <Label className="text-xs">Host / sponsor label</Label>
                <Input
                  defaultValue={table.hostName ?? ""}
                  onBlur={(e) => updateTable(table.id, { hostName: e.target.value || undefined })}
                />
              </div>
              <div>
                <Label className="text-xs">Sponsor tag</Label>
                <Input
                  defaultValue={table.hostTag ?? ""}
                  onBlur={(e) => updateTable(table.id, { hostTag: e.target.value || undefined })}
                />
              </div>
              <div>
                <Label className="text-xs">Notes</Label>
                <Input
                  defaultValue={table.notes ?? ""}
                  placeholder="e.g. Near bar"
                  onBlur={(e) => updateTable(table.id, { notes: e.target.value || undefined })}
                />
              </div>
              {(() => {
                const assignedGuests = guests.filter(
                  (g) => g.tableId === table.id && !g.isPlaceholder,
                );
                if (assignedGuests.length === 0) return null;
                return (
                  <div className="pt-2 border-t border-border">
                    <button
                      onClick={() => {
                        if (!window.confirm(
                          `Unassign all ${assignedGuests.length} guests from Table ${table.label}? They will move to Unassigned.`,
                        )) return;
                        assignedGuests.forEach((g) =>
                          updateGuest(g.id, { tableId: undefined, seatIndex: undefined }),
                        );
                        toast.success(`${assignedGuests.length} guests moved to Unassigned`);
                        setPopoverOpen(false);
                      }}
                      className="w-full h-8 text-xs rounded-md border border-amber-300 text-amber-700 hover:bg-amber-50 dark:hover:bg-amber-950/30"
                    >
                      Unassign all {assignedGuests.length} guests
                    </button>
                  </div>
                );
              })()}
              <div className="flex items-center justify-between pt-2 border-t border-border">
                <span className="text-xs text-muted-foreground">Rotate seats</span>
                <div className="flex gap-1">
                  <button
                    onClick={() => { setPopoverOpen(false); requestRotate("ccw"); }}
                    className="h-8 w-8 inline-flex items-center justify-center rounded-md border border-input hover:bg-accent"
                    title="Rotate counter-clockwise"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => { setPopoverOpen(false); requestRotate("cw"); }}
                    className="h-8 w-8 inline-flex items-center justify-center rounded-md border border-input hover:bg-accent"
                    title="Rotate clockwise"
                  >
                    <RotateCw className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </PopoverContent>
          </Popover>
          {!zoomed && (
            <button
              onClick={() => setPopoverOpen(true)}
              className="opacity-0 group-hover/label:opacity-100 transition-opacity p-0.5 rounded hover:bg-accent shrink-0"
              title="Edit table"
            >
              <Pencil className="h-3 w-3 text-muted-foreground" />
            </button>
          )}
        </div>
        <div className="flex items-center gap-1 text-[10px] font-mono text-muted-foreground">
          {hasViolation && (
            <span title="Rule violation">
              <TriangleAlert className="h-3 w-3 text-[color:var(--color-violation)]" />
            </span>
          )}
          {hasVip && <Star className="h-3 w-3 fill-vip text-vip" />}
          {hasAcc && <Accessibility className="h-3 w-3" />}
          {dietList.length > 0 && (
            <span
              className="h-2 w-2 rounded-full bg-[color:var(--color-dietary-alert)]"
              title={dietList.map((g) => `${g.name}: ${g.dietary}`).join("\n")}
            />
          )}
          {editingSeats ? (
            <input
              type="number" min={2} max={24}
              defaultValue={table.seats}
              className="w-12 font-mono text-xs border border-input rounded px-1 h-5"
              autoFocus
              onBlur={(e) => {
                const newSeats = Math.max(2, parseInt(e.target.value) || table.seats);
                if (newSeats < table.seats) {
                  const { overflowGuests } = checkSeatReduction(table.id, newSeats);
                  if (overflowGuests.length > 0) {
                    setSeatReductionPending({ tableId: table.id, newSeats, overflowGuests });
                    setEditingSeats(false);
                    return;
                  }
                }
                updateTable(table.id, { seats: newSeats });
                setEditingSeats(false);
              }}
              onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
            />
          ) : (
            <button
              onClick={() => setEditingSeats(true)}
              className="font-mono text-muted-foreground text-[10px] hover:underline hover:text-foreground"
              title="Click to edit seat count"
            >
              {occupied}/{table.seats}
            </button>
          )}
          {!zoomed && onRequestZoom && (
            <button
              onClick={onRequestZoom}
              className="opacity-0 group-hover:opacity-100 transition-opacity h-5 w-5 inline-flex items-center justify-center rounded hover:bg-accent ml-1"
              title="Enlarge table"
            >
              <Maximize2 className="h-3 w-3" />
            </button>
          )}
          {!zoomed && (
            <button
              onClick={() => {
                const assignedCount = guests.filter(
                  (g) => g.tableId === table.id && g.rsvpStatus !== "Declined" && g.rsvpStatus !== "No-show",
                ).length;
                if (assignedCount > 0) {
                  toast.error(`Table ${table.label} has ${assignedCount} assigned guest(s) — unassign them first`);
                  return;
                }
                removeTable(table.id);
                toast.success(`Table ${table.label} removed`);
              }}
              className="opacity-0 group-hover:opacity-100 transition-opacity h-5 w-5 inline-flex items-center justify-center rounded hover:bg-destructive/10 hover:text-destructive ml-0.5"
              title="Remove table"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>
      </div>

      <svg viewBox={`0 0 ${viewSize} ${viewSize}`} className="w-full h-auto overflow-visible" style={{ overflow: "visible" }}>
        <circle cx={cx} cy={cy} r={isLabelMode ? 80 : 70} fill="var(--color-table-surface)" stroke="var(--color-table-ring)" strokeWidth="1" />
        <text x={cx} y={cy - 4} textAnchor="middle" className="font-display fill-foreground" fontSize="18">
          {table.label}
        </text>
        <text x={cx} y={cy + 14} textAnchor="middle" className="font-mono fill-muted-foreground" fontSize="9">
          {table.seats} PAX
        </text>
        {seats.map((s) => {
          const angle = ((s - 1 + seatOffset) / table.seats) * Math.PI * 2 + Math.PI / 2;
          const x = cx + Math.cos(angle) * radius;
          const y = cy + Math.sin(angle) * radius;
          const guest = seatMap.get(s);
          const isHost = guest && table.hostGuestId === guest.id;
          const isSelected = selectedSeat?.tableId === table.id && selectedSeat.seatIndex === s;
          const isViolating = guest && violatingGuestIds?.has(guest.id);
          const isPlaceholderSeat = guest?.isPlaceholder === true;
          let fill = "var(--color-seat)";
          let dash: string | undefined;
          if (guest) {
            if (isHost) fill = "oklch(0.78 0.18 80)";
            else if (guest.tags.includes("VIP")) fill = "var(--color-vip)";
            else fill = "var(--color-seat-occupied)";
            if (guest.rsvpStatus === "Pending") {
              fill = "var(--color-rsvp-pending)";
              dash = "3 2";
            } else if (guest.rsvpStatus === "Waitlist") {
              fill = "var(--color-rsvp-waitlist)";
              dash = "1 2";
            }
          }
          if (isPlaceholderSeat) {
            fill = "var(--color-muted, #e5e7eb)";
            dash = "4 2";
          }
          const strokeColor = isSelected
            ? "var(--color-primary)"
            : isViolating
            ? "var(--color-violation)"
            : "var(--color-table-ring)";
          const cohortColor = guest?.cohort ? cohortColorMap?.get(guest.cohort) : undefined;
          return (
            <g key={s} transform={`translate(${x}, ${y})`} className="cursor-pointer" onClick={() => handleSeatClick(s)}>
              {cohortColor && (
                <circle r={17} fill="none" stroke={cohortColor} strokeWidth={2} opacity={0.7} />
              )}
              <circle
                r={14}
                fill={fill}
                stroke={strokeColor}
                strokeWidth={isSelected || isViolating ? 2.5 : 1}
                strokeDasharray={dash}
              />
              {isPlaceholderSeat ? (
                <>
                  <text textAnchor="middle" dy="1" className="fill-muted-foreground font-mono pointer-events-none" fontSize="11" fontWeight="600">?</text>
                  {guest?.company && (
                    <text textAnchor="middle" dy="10" className="fill-muted-foreground pointer-events-none" fontSize="6">
                      {guest.company.slice(0, 4).toUpperCase()}
                    </text>
                  )}
                </>
              ) : (
                <text textAnchor="middle" dy="3" className="fill-foreground font-mono pointer-events-none" fontSize="9">
                  {s}
                </text>
              )}
              {isPlaceholderSeat ? (
                <title>TBC · {guest?.company ?? "Unknown"} — awaiting name{guest?.meal && guest.meal !== "None" ? ` · ${guest.meal}` : ""}</title>
              ) : guest && (
                <title>
                  {guest.name}
                  {guest.company ? ` · ${guest.company}` : ""}
                  {guest.meal !== "None" ? ` · ${guest.meal}` : ""}
                  {guest.cohort ? ` · ${guest.cohort}` : ""}
                  {guest.rsvpStatus !== "Confirmed" ? ` · ${guest.rsvpStatus}` : ""}
                  {guest.dietary ? `\n⚠️ ${guest.dietary}` : ""}
                  {guest.notes ? `\n📝 ${guest.notes}` : ""}
                  {guest.locked ? `\n🔒 Locked` : ""}
                </title>
              )}
              {isHost && (
                <text textAnchor="middle" dy="-16" fontSize="10" fill="oklch(0.55 0.2 80)" className="pointer-events-none">♛</text>
              )}
              {guest?.locked && (
                <text textAnchor="middle" dy="-15" x={-10} fontSize="8" className="pointer-events-none select-none">🔒</text>
              )}
              {guest?.tags.includes("Wheelchair") && (
                <circle r={3} cx={11} cy={-10} fill="var(--color-primary)" />
              )}
              {guest?.meal && MEAL_EMOJI[guest.meal] && (
                <text x={-12} y={-8} fontSize="8" className="pointer-events-none">{MEAL_EMOJI[guest.meal]}</text>
              )}
              {guest?.dietary && (
                <circle r={3} cx={11} cy={10} fill="var(--color-dietary-alert)" />
              )}
            </g>
          );
        })}
        {isLabelMode && seats.map((s) => {
          const guest = seatMap.get(s);
          if (!guest || guest.isPlaceholder) return null;
          const angle = ((s - 1 + seatOffset) / table.seats) * Math.PI * 2 + Math.PI / 2;
          const labelR = seatLabelMode === "name+firm" ? radius + 34 : radius + 26;
          const lx = cx + Math.cos(angle) * labelR;
          const ly = cy + Math.sin(angle) * labelR;
          const fullName = guest.name || [guest.firstName, guest.lastName].filter(Boolean).join(" ");
          const displayName = fullName.length > 22 ? fullName.slice(0, 21) + "…" : fullName;
          const showFirm = seatLabelMode === "name+firm" && guest.company;
          const displayFirm = showFirm
            ? (guest.company!.length > 18 ? guest.company!.slice(0, 17) + "…" : guest.company!)
            : "";
          return (
            <g key={`lbl-${s}`} transform={`translate(${lx}, ${ly})`} className="pointer-events-none">
              <text textAnchor="middle" dy="3" fontSize="8.5" fontWeight="500" className="fill-foreground">
                {displayName}
              </text>
              {displayFirm && (
                <text textAnchor="middle" dy="14" fontSize="6.5" className="fill-muted-foreground">
                  {displayFirm}
                </text>
              )}
            </g>
          );
        })}
      </svg>

      <div className={`table-guest-list mt-2 text-[11px] max-h-60 overflow-y-auto ${
        table.seats >= 7 ? "grid grid-cols-2 gap-x-3 gap-y-0.5" : "space-y-0.5"
      }`}>
        {seats.map((s) => {
          const guest = seatMap.get(s);
          const ghost = guests.find((g) => g.seatIndex === s && (g.rsvpStatus === "Declined" || g.rsvpStatus === "No-show"));
          const isHost = guest && table.hostGuestId === guest.id;
          return (
            <div key={s} className="flex items-center gap-1.5 group/row break-inside-avoid">
              <span className="font-mono text-muted-foreground w-4 text-right">{s}</span>
              {guest ? (
                guest.isPlaceholder ? (
                  <>
                    <span className="italic text-muted-foreground/70 flex-1 truncate">
                      TBC {guest.company ? `· ${guest.company}` : ""}
                    </span>
                    <button
                      onClick={() => unassignGuest(guest.id)}
                      className="text-destructive text-[11px] shrink-0 hover:underline"
                      title="Remove TBC placeholder"
                    >
                      ×
                    </button>
                  </>
                ) : (
                <>
                  <span className="truncate flex-1">
                    {isHost && (
                      <>
                        <span className="text-[color:oklch(0.55_0.2_80)] mr-0.5">♛</span>
                        <span className="text-[8px] uppercase tracking-wider font-semibold bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 px-1 py-0.5 rounded mr-0.5 inline-block leading-none align-middle">HOST</span>
                      </>
                    )}
                    <span
                      onClick={() => onEditGuest?.(guest.id)}
                      className="cursor-pointer hover:text-primary hover:underline"
                      title="Click to edit guest details"
                    >
                      {guest.name}
                    </span>
                    {showFirmInList && guest.company && (
                      <span className="text-muted-foreground"> · {guest.company}</span>
                    )}
                  </span>
                  <button
                    onClick={() => updateGuest(guest.id, { locked: !guest.locked })}
                    className={`text-[10px] shrink-0 ${guest.locked ? "text-amber-500" : "text-muted-foreground/30 hover:text-muted-foreground"}`}
                    title={guest.locked ? "Locked to this seat (click to unlock)" : "Click to lock to this seat"}
                  >
                    {guest.locked ? "🔒" : "○"}
                  </button>
                  <button
                    onClick={() => unassignGuest(guest.id)}
                    className="opacity-0 group-hover/row:opacity-100 text-destructive text-[10px] shrink-0"
                    title="Unassign"
                  >
                    ×
                  </button>
                </>
                )
              ) : ghost ? (
                <span className="line-through text-muted-foreground/60 flex-1 truncate">{ghost.name}</span>
              ) : (
                <span className="text-muted-foreground/50 italic flex-1">empty</span>
              )}
            </div>
          );
        })}
      </div>

      {!zoomed && (
        <div className="absolute bottom-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-10">
          <button
            onClick={(e) => { e.stopPropagation(); downloadTablePNG(); }}
            className="h-7 w-7 rounded-md border border-input bg-card/90 hover:bg-accent inline-flex items-center justify-center shadow-sm"
            title={`Download Table ${table.label} as PNG`}
          >
            <Camera className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); requestRotate("ccw"); }}
            className="h-7 w-7 rounded-md border border-input bg-card/90 hover:bg-accent inline-flex items-center justify-center shadow-sm"
            title="Rotate CCW — moves which seat faces stage"
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); requestRotate("cw"); }}
            className="h-7 w-7 rounded-md border border-input bg-card/90 hover:bg-accent inline-flex items-center justify-center shadow-sm"
            title="Rotate CW — moves which seat faces stage"
          >
            <RotateCw className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      <AlertDialog open={rotateOpen} onOpenChange={setRotateOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Rotate Table {table.label} {rotateDir === "cw" ? "clockwise" : "counter-clockwise"}?</AlertDialogTitle>
            <AlertDialogDescription>
              All guests at this table will shift one seat {rotateDir === "cw" ? "clockwise" : "counter-clockwise"}.
              Seat number positions stay fixed — only guest assignments rotate.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => { rotateTable(table.id, rotateDir); setRotateOpen(false); }}>
              Rotate
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={!!seatReductionPending}
        onOpenChange={(v) => { if (!v) setSeatReductionPending(null); }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Reducing Table {table.label} to {seatReductionPending?.newSeats} seats
            </AlertDialogTitle>
            <AlertDialogDescription>
              {seatReductionPending?.overflowGuests.length} guest(s) are assigned to seats that would no longer exist:
              {" "}<strong>{seatReductionPending?.overflowGuests.map((g) => g.name).join(", ")}</strong>.
              They will be moved to Unassigned if you continue.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setSeatReductionPending(null)}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90"
              onClick={() => {
                if (seatReductionPending) {
                  reduceTableSeats(seatReductionPending.tableId, seatReductionPending.newSeats, "unassign");
                  toast.warning(`${seatReductionPending.overflowGuests.length} guest(s) moved to Unassigned`);
                }
                setSeatReductionPending(null);
              }}
            >
              Reduce seats & unassign
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

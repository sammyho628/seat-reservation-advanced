import { usePlanStore, type Table, type Guest } from "@/lib/plan-store";
import { Star, Accessibility, TriangleAlert, RotateCw, RotateCcw } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

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
}

export function TableCircle({
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
}: Props) {
  const allGuests = usePlanStore((s) => s.guests);
  const updateTable = usePlanStore((s) => s.updateTable);
  const swapSeats = usePlanStore((s) => s.swapSeats);
  const unassignGuest = usePlanStore((s) => s.unassignGuest);
  const setTableHost = usePlanStore((s) => s.setTableHost);
  const rotateTable = usePlanStore((s) => s.rotateTable);

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

  function handleSeatClick(seatIndex: number) {
    if (selectedGuestId && !seatMap.get(seatIndex)) {
      onAssignGuest?.(table.id, seatIndex);
      return;
    }
    if (selectedSeat && (selectedSeat.tableId !== table.id || selectedSeat.seatIndex !== seatIndex)) {
      swapSeats(selectedSeat, { tableId: table.id, seatIndex });
      onSelectSeat(null);
      return;
    }
    if (selectedSeat?.tableId === table.id && selectedSeat.seatIndex === seatIndex) {
      onSelectSeat(null);
      return;
    }
    onSelectSeat({ tableId: table.id, seatIndex });
  }

  const seats = Array.from({ length: table.seats }, (_, i) => i + 1);
  const radius = Math.min(105, 60 + table.seats * 4);
  const cx = 120;
  const cy = 120;

  return (
    <div
      className={`relative rounded-xl border bg-card p-3 group transition-shadow ${
        highlighted ? "ring-2 ring-primary animate-pulse border-primary" : "border-table-ring"
      }`}
    >
      <div className="flex items-center justify-between mb-1 px-1">
        <Popover>
          <PopoverTrigger asChild>
            <button className="font-display text-sm tracking-wider hover:underline text-left">
              TABLE {table.label}
              {table.hostName && (
                <span className="block text-[10px] text-muted-foreground italic font-sans tracking-normal">
                  {table.hostName}
                </span>
              )}
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-72 space-y-3" align="start">
            <div>
              <Label className="text-xs">Label</Label>
              <Input
                defaultValue={table.label}
                onBlur={(e) => updateTable(table.id, { label: e.target.value.slice(0, 12) || table.label })}
              />
            </div>
            <div>
              <Label className="text-xs">Seats</Label>
              <Input
                type="number"
                min={2}
                max={24}
                defaultValue={table.seats}
                onBlur={(e) => updateTable(table.id, { seats: Math.max(2, parseInt(e.target.value) || table.seats) })}
              />
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
            <div className="flex items-center justify-between pt-2 border-t border-border">
              <span className="text-xs text-muted-foreground">Rotate seats</span>
              <div className="flex gap-1">
                <button
                  onClick={() => rotateTable(table.id, "ccw")}
                  className="h-8 w-8 inline-flex items-center justify-center rounded-md border border-input hover:bg-accent"
                  title="Rotate counter-clockwise"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => rotateTable(table.id, "cw")}
                  className="h-8 w-8 inline-flex items-center justify-center rounded-md border border-input hover:bg-accent"
                  title="Rotate clockwise"
                >
                  <RotateCw className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </PopoverContent>
        </Popover>
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
          <span>{occupied}/{table.seats}</span>
        </div>
      </div>

      <svg viewBox="0 0 240 240" className="w-full h-auto">
        <circle cx={cx} cy={cy} r={70} fill="var(--color-table-surface)" stroke="var(--color-table-ring)" strokeWidth="1" />
        <text x={cx} y={cy - 4} textAnchor="middle" className="font-display fill-foreground" fontSize="18">
          {table.label}
        </text>
        <text x={cx} y={cy + 14} textAnchor="middle" className="font-mono fill-muted-foreground" fontSize="9">
          {table.seats} PAX
        </text>
        {seats.map((s) => {
          const angle = (s / table.seats) * Math.PI * 2 - Math.PI / 2;
          const x = cx + Math.cos(angle) * radius;
          const y = cy + Math.sin(angle) * radius;
          const guest = seatMap.get(s);
          const isHost = guest && table.hostGuestId === guest.id;
          const isSelected = selectedSeat?.tableId === table.id && selectedSeat.seatIndex === s;
          const isViolating = guest && violatingGuestIds?.has(guest.id);
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
          const strokeColor = isSelected
            ? "var(--color-primary)"
            : isViolating
            ? "var(--color-violation)"
            : "var(--color-table-ring)";
          const cohortColor = guest?.cohort ? cohortColorMap?.get(guest.cohort) : undefined;
          const labelText =
            seatLabelMode === "none" || !guest
              ? ""
              : seatLabelMode === "name"
              ? (guest.lastName || guest.name.split(" ")[0] || "").slice(0, 8)
              : `${(guest.lastName || guest.name.split(" ")[0] || "").slice(0, 6)}${guest.company ? "·" + guest.company.slice(0, 4) : ""}`;
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
              <text textAnchor="middle" dy="3" className="fill-foreground font-mono pointer-events-none" fontSize="9">
                {s}
              </text>
              {guest && (
                <title>
                  {guest.name}
                  {guest.company ? ` · ${guest.company}` : ""}
                  {guest.meal !== "None" ? ` · ${guest.meal}` : ""}
                  {guest.cohort ? ` · ${guest.cohort}` : ""}
                  {guest.rsvpStatus !== "Confirmed" ? ` · ${guest.rsvpStatus}` : ""}
                  {guest.dietary ? `\n⚠️ ${guest.dietary}` : ""}
                </title>
              )}
              {isHost && (
                <text textAnchor="middle" dy="-16" fontSize="10" fill="oklch(0.55 0.2 80)" className="pointer-events-none">♛</text>
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
              {labelText && (
                <text textAnchor="middle" dy="24" fontSize="7" className="fill-muted-foreground pointer-events-none font-mono">
                  {labelText}
                </text>
              )}
            </g>
          );
        })}
      </svg>

      <div className={`mt-2 text-[11px] space-y-0.5 max-h-40 overflow-y-auto ${table.seats > 12 ? "columns-2 gap-x-3" : ""}`}>
        {seats.map((s) => {
          const guest = seatMap.get(s);
          const ghost = guests.find((g) => g.seatIndex === s && (g.rsvpStatus === "Declined" || g.rsvpStatus === "No-show"));
          const isHost = guest && table.hostGuestId === guest.id;
          return (
            <div key={s} className="flex items-center gap-1.5 group/row break-inside-avoid">
              <span className="font-mono text-muted-foreground w-4 text-right">{s}</span>
              {guest ? (
                <>
                  <span className="truncate flex-1">
                    {isHost && <span className="text-[color:oklch(0.55_0.2_80)] mr-0.5">♛</span>}
                    {guest.name}
                    {showFirmInList && guest.company && (
                      <span className="text-muted-foreground"> · {guest.company}</span>
                    )}
                  </span>
                  <button
                    onClick={() => unassignGuest(guest.id)}
                    className="opacity-0 group-hover/row:opacity-100 text-destructive text-[10px]"
                    title="Unassign"
                  >
                    ×
                  </button>
                </>
              ) : ghost ? (
                <span className="line-through text-muted-foreground/60 flex-1 truncate">{ghost.name}</span>
              ) : (
                <span className="text-muted-foreground/50 italic flex-1">empty</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

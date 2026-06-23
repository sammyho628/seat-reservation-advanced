import { usePlanStore, type Table, type Guest } from "@/lib/plan-store";
import { useState } from "react";
import { Star, Accessibility, TriangleAlert } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface Props {
  table: Table;
  guests: Guest[];
  selectedSeat: { tableId: string; seatIndex: number } | null;
  onSelectSeat: (sel: { tableId: string; seatIndex: number } | null) => void;
  selectedGuestId?: string | null;
  onAssignGuest?: (tableId: string, seatIndex: number) => void;
  highlighted?: boolean;
  violatingGuestIds?: Set<string>;
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
}: Props) {
  const updateTable = usePlanStore((s) => s.updateTable);
  const swapSeats = usePlanStore((s) => s.swapSeats);
  const unassignGuest = usePlanStore((s) => s.unassignGuest);

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
          <PopoverContent className="w-64 space-y-3" align="start">
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
              <Label className="text-xs">Host / sponsor name</Label>
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
          const isSelected = selectedSeat?.tableId === table.id && selectedSeat.seatIndex === s;
          const isViolating = guest && violatingGuestIds?.has(guest.id);
          let fill = "var(--color-seat)";
          let dash: string | undefined;
          if (guest) {
            if (guest.tags.includes("VIP")) fill = "var(--color-vip)";
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
          return (
            <g key={s} transform={`translate(${x}, ${y})`} className="cursor-pointer" onClick={() => handleSeatClick(s)}>
              <circle
                r={14}
                fill={fill}
                stroke={strokeColor}
                strokeWidth={isSelected || isViolating ? 2.5 : 1}
                strokeDasharray={dash}
              />
              <text textAnchor="middle" dy="3" className="fill-foreground font-mono" fontSize="9">
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
              {guest?.tags.includes("Wheelchair") && (
                <circle r={5} cx={10} cy={-10} fill="var(--color-primary)" />
              )}
              {guest?.dietary && (
                <circle r={4} cx={10} cy={10} fill="var(--color-dietary-alert)" />
              )}
            </g>
          );
        })}
      </svg>

      <div className="mt-2 text-[11px] space-y-0.5 max-h-32 overflow-y-auto">
        {seats.map((s) => {
          const guest = seatMap.get(s);
          // ghosted: guest had this seat but RSVP changed
          const ghost = guests.find((g) => g.seatIndex === s && (g.rsvpStatus === "Declined" || g.rsvpStatus === "No-show"));
          return (
            <div key={s} className="flex items-center gap-1.5 group/row">
              <span className="font-mono text-muted-foreground w-4 text-right">{s}</span>
              {guest ? (
                <>
                  <span className="truncate flex-1">{guest.name}</span>
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

import { usePlanStore, type Table, type Guest } from "@/lib/plan-store";
import { useState } from "react";
import { Star, Accessibility } from "lucide-react";

interface Props {
  table: Table;
  guests: Guest[];
  selectedSeat: { tableId: string; seatIndex: number } | null;
  onSelectSeat: (sel: { tableId: string; seatIndex: number } | null) => void;
  selectedGuestId?: string | null;
  onAssignGuest?: (tableId: string, seatIndex: number) => void;
}

export function TableCircle({
  table,
  guests,
  selectedSeat,
  onSelectSeat,
  selectedGuestId,
  onAssignGuest,
}: Props) {
  const updateTable = usePlanStore((s) => s.updateTable);
  const swapSeats = usePlanStore((s) => s.swapSeats);
  const unassignGuest = usePlanStore((s) => s.unassignGuest);
  const [editing, setEditing] = useState(false);

  const seatMap = new Map<number, Guest>();
  guests.forEach((g) => {
    if (g.seatIndex) seatMap.set(g.seatIndex, g);
  });

  const occupied = seatMap.size;
  const hasVip = guests.some((g) => g.tags.includes("VIP"));

  function handleSeatClick(seatIndex: number) {
    // assignment from sidebar takes priority
    if (selectedGuestId && !seatMap.get(seatIndex)) {
      onAssignGuest?.(table.id, seatIndex);
      return;
    }
    // swap flow
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
  // Layout seats around circle
  const radius = 95;
  const cx = 120;
  const cy = 120;

  return (
    <div className="relative rounded-xl border border-table-ring bg-card p-3 group">
      <div className="flex items-center justify-between mb-1 px-1">
        {editing ? (
          <input
            autoFocus
            defaultValue={table.label}
            onBlur={(e) => {
              updateTable(table.id, { label: e.target.value.toUpperCase().slice(0, 6) || table.label });
              setEditing(false);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") (e.target as HTMLInputElement).blur();
              if (e.key === "Escape") setEditing(false);
            }}
            className="font-display text-sm w-16 bg-transparent border-b border-foreground/30 focus:outline-none"
          />
        ) : (
          <button
            onClick={() => setEditing(true)}
            className="font-display text-sm tracking-wider hover:underline"
          >
            TABLE {table.label}
          </button>
        )}
        <div className="flex items-center gap-1 text-[10px] font-mono text-muted-foreground">
          {hasVip && <Star className="h-3 w-3 fill-vip text-vip" />}
          <span>
            {occupied}/{table.seats}
          </span>
        </div>
      </div>

      <svg viewBox="0 0 240 240" className="w-full h-auto">
        <circle cx={cx} cy={cy} r={70} fill="var(--color-table-surface)" stroke="var(--color-table-ring)" strokeWidth="1" />
        <text
          x={cx}
          y={cy - 4}
          textAnchor="middle"
          className="font-display fill-foreground"
          fontSize="18"
        >
          {table.label}
        </text>
        <text
          x={cx}
          y={cy + 14}
          textAnchor="middle"
          className="font-mono fill-muted-foreground"
          fontSize="9"
        >
          {table.seats} PAX
        </text>
        {seats.map((s) => {
          const angle = (s / table.seats) * Math.PI * 2 - Math.PI / 2;
          const x = cx + Math.cos(angle) * radius;
          const y = cy + Math.sin(angle) * radius;
          const guest = seatMap.get(s);
          const isSelected =
            selectedSeat?.tableId === table.id && selectedSeat.seatIndex === s;
          const fill = guest
            ? guest.tags.includes("VIP")
              ? "var(--color-vip)"
              : "var(--color-seat-occupied)"
            : "var(--color-seat)";
          return (
            <g
              key={s}
              transform={`translate(${x}, ${y})`}
              className="cursor-pointer"
              onClick={() => handleSeatClick(s)}
            >
              <circle
                r={14}
                fill={fill}
                stroke={isSelected ? "var(--color-primary)" : "var(--color-table-ring)"}
                strokeWidth={isSelected ? 2.5 : 1}
              />
              <text
                textAnchor="middle"
                dy="3"
                className="fill-foreground font-mono"
                fontSize="9"
              >
                {s}
              </text>
              {guest && (
                <title>
                  {guest.name} {guest.company ? `· ${guest.company}` : ""} {guest.meal !== "None" ? `· ${guest.meal}` : ""}
                </title>
              )}
              {guest?.tags.includes("Wheelchair") && (
                <circle r={5} cx={10} cy={-10} fill="var(--color-primary)" />
              )}
            </g>
          );
        })}
      </svg>

      {/* Guest list below */}
      <div className="mt-2 text-[11px] space-y-0.5 max-h-32 overflow-y-auto">
        {seats.map((s) => {
          const guest = seatMap.get(s);
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

import { usePlanStore, parseRowPattern } from "@/lib/plan-store";
import { TableCircle } from "./TableCircle";
import { useState } from "react";

interface Props {
  selectedGuestId: string | null;
  onAfterAssign: () => void;
}

export function PlannerGrid({ selectedGuestId, onAfterAssign }: Props) {
  const tables = usePlanStore((s) => s.tables);
  const guests = usePlanStore((s) => s.guests);
  const settings = usePlanStore((s) => s.settings);
  const assignGuest = usePlanStore((s) => s.assignGuest);

  const [selectedSeat, setSelectedSeat] = useState<{
    tableId: string;
    seatIndex: number;
  } | null>(null);

  const rowSizes = parseRowPattern(settings.rowPattern);
  const rows: { id: string; tables: typeof tables }[] = [];
  let cursor = 0;
  rowSizes.forEach((count, i) => {
    rows.push({ id: `row-${i}`, tables: tables.slice(cursor, cursor + count) });
    cursor += count;
  });
  // any leftover tables
  if (cursor < tables.length) {
    rows.push({ id: "row-extra", tables: tables.slice(cursor) });
  }

  function handleAssign(tableId: string, seatIndex: number) {
    if (!selectedGuestId) return;
    assignGuest(selectedGuestId, tableId, seatIndex);
    onAfterAssign();
  }

  return (
    <div className="space-y-6">
      {settings.showStage && (
        <div className="flex justify-center">
          <div className="px-12 py-3 bg-stage text-background rounded-md font-display tracking-[0.3em] text-sm">
            STAGE
          </div>
        </div>
      )}
      {rows.map((row) => (
        <div
          key={row.id}
          className="grid gap-4"
          style={{ gridTemplateColumns: `repeat(${row.tables.length}, minmax(0, 1fr))` }}
        >
          {row.tables.map((t) => (
            <TableCircle
              key={t.id}
              table={t}
              guests={guests.filter((g) => g.tableId === t.id)}
              selectedSeat={selectedSeat}
              onSelectSeat={setSelectedSeat}
              selectedGuestId={selectedGuestId}
              onAssignGuest={handleAssign}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

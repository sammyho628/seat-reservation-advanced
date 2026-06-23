import { usePlanStore, parseRowPattern } from "@/lib/plan-store";
import { TableCircle } from "./TableCircle";
import { useState } from "react";
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
  type DragEndEvent,
} from "@dnd-kit/core";
import { SortableContext, useSortable, rectSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

interface Props {
  selectedGuestId: string | null;
  onAfterAssign: () => void;
  highlightedTableId?: string | null;
  violatingGuestIds?: Set<string>;
}

function SortableTable({ id, children }: { id: string; children: React.ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };
  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      {children}
    </div>
  );
}

export function PlannerGrid({ selectedGuestId, onAfterAssign, highlightedTableId, violatingGuestIds }: Props) {
  const tables = usePlanStore((s) => s.tables);
  const guests = usePlanStore((s) => s.guests);
  const settings = usePlanStore((s) => s.settings);
  const assignGuest = usePlanStore((s) => s.assignGuest);
  const reorderTables = usePlanStore((s) => s.reorderTables);

  const [selectedSeat, setSelectedSeat] = useState<{ tableId: string; seatIndex: number } | null>(null);

  const rowSizes = parseRowPattern(settings.rowPattern);
  const rows: { id: string; tables: typeof tables }[] = [];
  let cursor = 0;
  rowSizes.forEach((count, i) => {
    rows.push({ id: `row-${i}`, tables: tables.slice(cursor, cursor + count) });
    cursor += count;
  });
  if (cursor < tables.length) rows.push({ id: "row-extra", tables: tables.slice(cursor) });

  function handleAssign(tableId: string, seatIndex: number) {
    if (!selectedGuestId) return;
    assignGuest(selectedGuestId, tableId, seatIndex);
    onAfterAssign();
  }

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  function onDragEnd(e: DragEndEvent) {
    if (!e.over || e.over.id === e.active.id) return;
    const ids = tables.map((t) => t.id);
    const from = ids.indexOf(String(e.active.id));
    const to = ids.indexOf(String(e.over.id));
    if (from < 0 || to < 0) return;
    const next = [...ids];
    next.splice(from, 1);
    next.splice(to, 0, String(e.active.id));
    reorderTables(next);
  }

  return (
    <div id="planner-grid-capture" className="space-y-6 bg-background p-4 rounded-xl">
      {settings.showStage && (
        <div className="flex justify-center">
          <div className="px-12 py-3 bg-stage text-background rounded-md font-display tracking-[0.3em] text-sm">
            STAGE
          </div>
        </div>
      )}
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={tables.map((t) => t.id)} strategy={rectSortingStrategy}>
          {rows.map((row) => (
            <div
              key={row.id}
              className="grid gap-4"
              style={{ gridTemplateColumns: `repeat(${row.tables.length}, minmax(0, 1fr))` }}
            >
              {row.tables.map((t) => (
                <SortableTable key={t.id} id={t.id}>
                  <TableCircle
                    table={t}
                    guests={guests.filter((g) => g.tableId === t.id)}
                    selectedSeat={selectedSeat}
                    onSelectSeat={setSelectedSeat}
                    selectedGuestId={selectedGuestId}
                    onAssignGuest={handleAssign}
                    highlighted={highlightedTableId === t.id}
                    violatingGuestIds={violatingGuestIds}
                  />
                </SortableTable>
              ))}
            </div>
          ))}
        </SortableContext>
      </DndContext>
    </div>
  );
}

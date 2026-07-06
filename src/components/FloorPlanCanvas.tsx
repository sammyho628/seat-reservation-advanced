import { useMemo, useRef, useState } from "react";
import {
  DndContext,
  PointerSensor,
  useDraggable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { usePlanStore, type MarkerKind } from "@/lib/plan-store";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Star, Lock, Trash2, ImageUp, Music, Utensils, Wine, DoorOpen, StickyNote, Speaker } from "lucide-react";
import { toast } from "sonner";

// Logical canvas dimensions — CSS scales the whole SVG group to the container
const CANVAS_W = 1600;
const CANVAS_H = 1000;

const MARKER_META: Record<MarkerKind, { label: string; icon: React.ComponentType<any>; color: string }> = {
  stage:    { label: "Stage",    icon: Speaker,    color: "#7c3aed" },
  entrance: { label: "Entrance", icon: DoorOpen,   color: "#059669" },
  bar:      { label: "Bar",      icon: Wine,       color: "#b45309" },
  buffet:   { label: "Buffet",   icon: Utensils,   color: "#c026d3" },
  dj:       { label: "DJ",       icon: Music,      color: "#0ea5e9" },
  note:     { label: "Note",     icon: StickyNote, color: "#64748b" },
};

interface DraggableProps {
  id: string;
  x: number;
  y: number;
  children: React.ReactNode;
  disabled?: boolean;
  onClick?: () => void;
}

function DraggableItem({ id, x, y, children, disabled, onClick }: DraggableProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id, disabled });
  const style: React.CSSProperties = {
    position: "absolute",
    left: x,
    top: y,
    touchAction: "none",
    zIndex: isDragging ? 20 : 5,
    transform: transform ? CSS.Translate.toString(transform) : undefined,
    cursor: disabled ? "pointer" : "grab",
  };
  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners} onClick={onClick}>
      {children}
    </div>
  );
}

/** Auto-layout a table into a grid slot when it has no saved position yet. */
function autoPosition(index: number): { x: number; y: number } {
  const cols = 6;
  const cell = 200;
  const marginX = 80;
  const marginY = 200;
  const col = index % cols;
  const row = Math.floor(index / cols);
  return { x: marginX + col * cell, y: marginY + row * cell };
}

export function FloorPlanCanvas({ onOpenTable }: { onOpenTable?: (tableId: string) => void }) {
  const tables = usePlanStore((s) => s.tables);
  const guests = usePlanStore((s) => s.guests);
  const floorPlan = usePlanStore((s) => s.floorPlan);
  const setTablePosition = usePlanStore((s) => s.setTablePosition);
  const setTableShape = usePlanStore((s) => s.setTableShape);
  const setTableVip = usePlanStore((s) => s.setTableVip);
  const setFloorPlanBackground = usePlanStore((s) => s.setFloorPlanBackground);
  const setFloorPlanOpacity = usePlanStore((s) => s.setFloorPlanOpacity);
  const addFloorMarker = usePlanStore((s) => s.addFloorMarker);
  const updateFloorMarker = usePlanStore((s) => s.updateFloorMarker);
  const removeFloorMarker = usePlanStore((s) => s.removeFloorMarker);

  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.7);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  const positions = useMemo(() => {
    const map = new Map<string, { x: number; y: number }>();
    tables.forEach((t, i) => {
      const pos = floorPlan.tablePositions[t.id];
      map.set(t.id, pos ?? autoPosition(i));
    });
    return map;
  }, [tables, floorPlan.tablePositions]);

  function handleDragEnd(e: DragEndEvent) {
    const id = String(e.active.id);
    const dx = (e.delta.x ?? 0) / scale;
    const dy = (e.delta.y ?? 0) / scale;
    if (id.startsWith("marker:")) {
      const mid = id.slice("marker:".length);
      const m = floorPlan.markers.find((x) => x.id === mid);
      if (!m) return;
      updateFloorMarker(mid, { x: m.x + dx, y: m.y + dy });
    } else {
      const cur = positions.get(id) ?? { x: 0, y: 0 };
      setTablePosition(id, cur.x + dx, cur.y + dy);
    }
  }

  function onUploadBackground(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > 4 * 1024 * 1024) {
      toast.warning("Large image — the plan JSON will grow significantly");
    }
    const reader = new FileReader();
    reader.onload = () => setFloorPlanBackground(String(reader.result));
    reader.readAsDataURL(f);
  }

  function addMarker(kind: MarkerKind) {
    // Drop near the top-centre of the canvas
    addFloorMarker(kind, CANVAS_W / 2 - 60, 60, MARKER_META[kind].label);
  }

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 no-print">
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Add marker:</span>
        {(Object.keys(MARKER_META) as MarkerKind[]).map((k) => {
          const M = MARKER_META[k];
          const Icon = M.icon;
          return (
            <button
              key={k}
              onClick={() => addMarker(k)}
              className="h-8 px-2 rounded-md border border-input text-xs inline-flex items-center gap-1 hover:bg-accent"
            >
              <Icon className="h-3.5 w-3.5" style={{ color: M.color }} /> {M.label}
            </button>
          );
        })}
        <div className="h-6 w-px bg-border mx-1" />
        <label className="h-8 px-2 rounded-md border border-input text-xs inline-flex items-center gap-1 hover:bg-accent cursor-pointer">
          <ImageUp className="h-3.5 w-3.5" />
          {floorPlan.backgroundImageDataUrl ? "Replace floor plan image" : "Upload floor plan image"}
          <input type="file" accept="image/*" className="hidden" onChange={onUploadBackground} />
        </label>
        {floorPlan.backgroundImageDataUrl && (
          <>
            <div className="inline-flex items-center gap-1.5 text-xs">
              <span className="text-muted-foreground">Opacity</span>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={floorPlan.backgroundOpacity}
                onChange={(e) => setFloorPlanOpacity(parseFloat(e.target.value))}
                className="w-24"
              />
            </div>
            <button
              onClick={() => setFloorPlanBackground(undefined)}
              className="h-8 px-2 rounded-md border border-destructive/40 text-destructive text-xs hover:bg-destructive/10"
            >
              Remove image
            </button>
          </>
        )}
        <div className="h-6 w-px bg-border mx-1" />
        <div className="inline-flex items-center gap-1.5 text-xs">
          <span className="text-muted-foreground">Zoom</span>
          <input
            type="range"
            min={0.3}
            max={1.2}
            step={0.05}
            value={scale}
            onChange={(e) => setScale(parseFloat(e.target.value))}
            className="w-24"
          />
          <span className="font-mono w-9 text-right">{Math.round(scale * 100)}%</span>
        </div>
        <button
          onClick={() => window.print()}
          className="ml-auto h-8 px-3 rounded-md border border-input text-xs hover:bg-accent"
        >
          Print floor plan
        </button>
      </div>

      {/* Canvas */}
      <div
        id="floor-plan-canvas"
        ref={containerRef}
        className="relative bg-muted/30 border border-border rounded-xl overflow-auto"
        style={{ height: "calc(100vh - 200px)", minHeight: 600 }}
      >
        <div
          className="relative origin-top-left"
          style={{ width: CANVAS_W * scale, height: CANVAS_H * scale }}
        >
          <div
            style={{
              position: "absolute",
              left: 0,
              top: 0,
              width: CANVAS_W,
              height: CANVAS_H,
              transform: `scale(${scale})`,
              transformOrigin: "top left",
              backgroundColor: "white",
              backgroundImage: "linear-gradient(#e5e7eb 1px, transparent 1px), linear-gradient(90deg, #e5e7eb 1px, transparent 1px)",
              backgroundSize: "40px 40px",
            }}
          >
            {floorPlan.backgroundImageDataUrl && (
              <img
                src={floorPlan.backgroundImageDataUrl}
                alt=""
                style={{
                  position: "absolute",
                  inset: 0,
                  width: "100%",
                  height: "100%",
                  objectFit: "contain",
                  opacity: floorPlan.backgroundOpacity,
                  pointerEvents: "none",
                }}
              />
            )}

            <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
              {/* Tables */}
              {tables.map((t) => {
                const pos = positions.get(t.id)!;
                const occupied = guests.filter(
                  (g) => g.tableId === t.id && g.rsvpStatus !== "Declined" && g.rsvpStatus !== "No-show" && g.rsvpStatus !== "Withdrawn",
                ).length;
                const isFull = occupied >= t.seats;
                const isEmpty = occupied === 0;
                const isVip = !!floorPlan.tableVip[t.id];
                const shape = floorPlan.tableShapes[t.id] ?? (t.seats > 10 ? "long" : "round");
                const size = shape === "long"
                  ? { w: 60 + t.seats * 14, h: 90 }
                  : { w: 80 + t.seats * 4, h: 80 + t.seats * 4 };
                const isLocked = guests.some((g) => g.tableId === t.id && g.locked);
                const bg = isVip
                  ? "linear-gradient(135deg, #fde68a, #fbbf24)"
                  : isEmpty
                  ? "#f3f4f6"
                  : isFull
                  ? "#a7f3d0"
                  : "#c7d2fe";
                const border = isVip ? "#b45309" : isFull ? "#059669" : isEmpty ? "#9ca3af" : "#4f46e5";
                return (
                  <DraggableItem key={t.id} id={t.id} x={pos.x} y={pos.y}>
                    <Popover>
                      <PopoverTrigger asChild>
                        <div
                          className="flex flex-col items-center justify-center shadow-md select-none"
                          style={{
                            width: size.w,
                            height: size.h,
                            background: bg,
                            border: `2px solid ${border}`,
                            borderRadius: shape === "long" ? 12 : "50%",
                            color: "#1f2937",
                          }}
                        >
                          <div className="font-display text-lg">Table {t.label}</div>
                          <div className="text-xs font-mono opacity-80">{occupied}/{t.seats}</div>
                          <div className="flex items-center gap-1 mt-0.5">
                            {isVip && <Star className="h-3 w-3" style={{ color: "#b45309" }} fill="currentColor" />}
                            {isLocked && <Lock className="h-3 w-3 text-amber-700" />}
                          </div>
                        </div>
                      </PopoverTrigger>
                      <PopoverContent className="w-64 space-y-2" align="center">
                        <div className="font-display text-lg">Table {t.label}</div>
                        <div className="text-xs text-muted-foreground">{occupied}/{t.seats} seats filled</div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => setTableShape(t.id, shape === "round" ? "long" : "round")}
                            className="h-8 px-2 flex-1 rounded-md border border-input text-xs hover:bg-accent"
                          >
                            {shape === "round" ? "Make long ▬" : "Make round ●"}
                          </button>
                          <button
                            onClick={() => setTableVip(t.id, !isVip)}
                            className={`h-8 px-2 flex-1 rounded-md text-xs inline-flex items-center justify-center gap-1 ${
                              isVip ? "bg-amber-400 text-amber-950" : "border border-input hover:bg-accent"
                            }`}
                          >
                            <Star className="h-3 w-3" /> {isVip ? "VIP on" : "Mark VIP"}
                          </button>
                        </div>
                        <div className="max-h-40 overflow-y-auto text-xs border-t pt-2 space-y-0.5">
                          {occupied === 0 ? (
                            <div className="text-muted-foreground italic">No one seated</div>
                          ) : (
                            guests
                              .filter((g) => g.tableId === t.id)
                              .sort((a, b) => (a.seatIndex ?? 0) - (b.seatIndex ?? 0))
                              .map((g) => (
                                <div key={g.id} className="flex justify-between gap-2 truncate">
                                  <span className="font-mono text-muted-foreground w-4 shrink-0">{g.seatIndex}</span>
                                  <span className="truncate flex-1">{g.name}</span>
                                  {g.source === "walk-in" && (
                                    <span className="text-[9px] px-1 rounded bg-amber-100 text-amber-800 shrink-0">walk-in</span>
                                  )}
                                </div>
                              ))
                          )}
                        </div>
                        <button
                          onClick={() => onOpenTable?.(t.id)}
                          className="w-full h-8 rounded-md bg-primary text-primary-foreground text-xs"
                        >
                          Open seat panel →
                        </button>
                      </PopoverContent>
                    </Popover>
                  </DraggableItem>
                );
              })}

              {/* Markers */}
              {floorPlan.markers.map((m) => {
                const M = MARKER_META[m.kind];
                const Icon = M.icon;
                return (
                  <DraggableItem key={m.id} id={`marker:${m.id}`} x={m.x} y={m.y}>
                    <div
                      className="relative px-3 py-2 rounded-md shadow-lg select-none flex items-center gap-2"
                      style={{ background: M.color, color: "white" }}
                    >
                      <Icon className="h-4 w-4" />
                      <span className="text-sm font-semibold uppercase tracking-wider">{m.label ?? M.label}</span>
                      <button
                        onClick={(e) => { e.stopPropagation(); removeFloorMarker(m.id); }}
                        className="ml-1 opacity-70 hover:opacity-100"
                        title="Remove marker"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  </DraggableItem>
                );
              })}
            </DndContext>
          </div>
        </div>
      </div>

      <div className="text-xs text-muted-foreground">
        Drag tables and markers to arrange the room. Positions and background image sync to every device that opens this plan.
      </div>
    </div>
  );
}

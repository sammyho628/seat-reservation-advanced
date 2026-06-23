import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

export type Tag = "VIP" | "Wheelchair" | "Child" | "Speaker" | "Sponsor";
export type Meal = "Chicken" | "Fish" | "Vegetarian" | "Vegan" | "Kids" | "None";

export interface Guest {
  id: string;
  name: string;
  company?: string;
  title?: string;
  group?: string; // party / sponsor table id
  meal: Meal;
  tags: Tag[];
  dietary?: string;
  notes?: string;
  tableId?: string;
  seatIndex?: number; // 1-based
}

export interface Table {
  id: string;
  label: string; // letter or custom
  seats: number;
  hostTag?: string; // sponsor/host
}

export type RuleType =
  | "keep_together"
  | "keep_apart"
  | "vip_near_stage"
  | "accessibility_edge"
  | "balance_company";

export interface Rule {
  id: string;
  type: RuleType;
  guestIds?: string[]; // for together / apart
  enabled: boolean;
}

export interface Settings {
  rowPattern: string; // e.g. "4:4:4:4"
  defaultSeats: number;
  eventTitle: string;
  primaryColor: string;
  showStage: boolean;
}

interface PlanState {
  settings: Settings;
  tables: Table[];
  guests: Guest[];
  rules: Rule[];

  setSettings: (patch: Partial<Settings>) => void;
  regenerateTables: () => void;
  updateTable: (id: string, patch: Partial<Table>) => void;

  addGuests: (guests: Omit<Guest, "id">[]) => void;
  updateGuest: (id: string, patch: Partial<Guest>) => void;
  removeGuest: (id: string) => void;
  clearGuests: () => void;

  assignGuest: (guestId: string, tableId: string, seatIndex?: number) => void;
  unassignGuest: (guestId: string) => void;
  swapSeats: (
    a: { tableId: string; seatIndex: number },
    b: { tableId: string; seatIndex: number },
  ) => void;

  addRule: (rule: Omit<Rule, "id">) => void;
  updateRule: (id: string, patch: Partial<Rule>) => void;
  removeRule: (id: string) => void;

  autoSeat: () => { assigned: number; unassigned: number; violations: number };
  resetAssignments: () => void;
  importPlan: (data: Partial<PlanState>) => void;
}

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

function letterLabel(i: number): string {
  // A..Z, AA, AB, ...
  let s = "";
  let n = i;
  do {
    s = String.fromCharCode(65 + (n % 26)) + s;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return s;
}

function parsePattern(pattern: string): number[] {
  return pattern
    .split(":")
    .map((s) => parseInt(s.trim(), 10))
    .filter((n) => Number.isFinite(n) && n > 0);
}

function buildTables(pattern: string, defaultSeats: number, existing: Table[]): Table[] {
  const rows = parsePattern(pattern);
  const total = rows.reduce((a, b) => a + b, 0);
  const out: Table[] = [];
  for (let i = 0; i < total; i++) {
    const prev = existing[i];
    out.push({
      id: prev?.id ?? uid(),
      label: prev?.label ?? letterLabel(i),
      seats: prev?.seats ?? defaultSeats,
      hostTag: prev?.hostTag,
    });
  }
  return out;
}

const initialSettings: Settings = {
  rowPattern: "4:4:4:4",
  defaultSeats: 10,
  eventTitle: "Annual Gala",
  primaryColor: "#7c3aed",
  showStage: true,
};

export const usePlanStore = create<PlanState>()(
  persist(
    (set, get) => ({
      settings: initialSettings,
      tables: buildTables(initialSettings.rowPattern, initialSettings.defaultSeats, []),
      guests: [],
      rules: [],

      setSettings: (patch) => {
        set((s) => ({ settings: { ...s.settings, ...patch } }));
        if (patch.rowPattern !== undefined || patch.defaultSeats !== undefined) {
          set((s) => ({
            tables: buildTables(s.settings.rowPattern, s.settings.defaultSeats, s.tables),
          }));
        }
      },

      regenerateTables: () =>
        set((s) => ({
          tables: buildTables(s.settings.rowPattern, s.settings.defaultSeats, s.tables),
        })),

      updateTable: (id, patch) =>
        set((s) => ({
          tables: s.tables.map((t) => (t.id === id ? { ...t, ...patch } : t)),
        })),

      addGuests: (guests) =>
        set((s) => ({
          guests: [...s.guests, ...guests.map((g) => ({ ...g, id: uid() }))],
        })),

      updateGuest: (id, patch) =>
        set((s) => ({ guests: s.guests.map((g) => (g.id === id ? { ...g, ...patch } : g)) })),

      removeGuest: (id) => set((s) => ({ guests: s.guests.filter((g) => g.id !== id) })),
      clearGuests: () => set({ guests: [] }),

      assignGuest: (guestId, tableId, seatIndex) =>
        set((s) => {
          const table = s.tables.find((t) => t.id === tableId);
          if (!table) return s;
          let seat = seatIndex;
          if (!seat) {
            const taken = new Set(
              s.guests.filter((g) => g.tableId === tableId && g.id !== guestId).map((g) => g.seatIndex),
            );
            for (let i = 1; i <= table.seats; i++) {
              if (!taken.has(i)) {
                seat = i;
                break;
              }
            }
          }
          if (!seat) return s; // table full
          return {
            guests: s.guests.map((g) =>
              g.id === guestId ? { ...g, tableId, seatIndex: seat } : g,
            ),
          };
        }),

      unassignGuest: (guestId) =>
        set((s) => ({
          guests: s.guests.map((g) =>
            g.id === guestId ? { ...g, tableId: undefined, seatIndex: undefined } : g,
          ),
        })),

      swapSeats: (a, b) =>
        set((s) => {
          const ga = s.guests.find((g) => g.tableId === a.tableId && g.seatIndex === a.seatIndex);
          const gb = s.guests.find((g) => g.tableId === b.tableId && g.seatIndex === b.seatIndex);
          return {
            guests: s.guests.map((g) => {
              if (ga && g.id === ga.id) return { ...g, tableId: b.tableId, seatIndex: b.seatIndex };
              if (gb && g.id === gb.id) return { ...g, tableId: a.tableId, seatIndex: a.seatIndex };
              return g;
            }),
          };
        }),

      addRule: (rule) => set((s) => ({ rules: [...s.rules, { ...rule, id: uid() }] })),
      updateRule: (id, patch) =>
        set((s) => ({ rules: s.rules.map((r) => (r.id === id ? { ...r, ...patch } : r)) })),
      removeRule: (id) => set((s) => ({ rules: s.rules.filter((r) => r.id !== id) })),

      resetAssignments: () =>
        set((s) => ({
          guests: s.guests.map((g) => ({ ...g, tableId: undefined, seatIndex: undefined })),
        })),

      autoSeat: () => {
        const state = get();
        const tables = state.tables.map((t) => ({ ...t }));
        // start fresh
        const guests = state.guests.map((g) => ({ ...g, tableId: undefined, seatIndex: undefined as number | undefined }));
        const rules = state.rules.filter((r) => r.enabled);

        // capacity per table
        const cap: Record<string, number> = {};
        const occupants: Record<string, string[]> = {};
        tables.forEach((t) => {
          cap[t.id] = t.seats;
          occupants[t.id] = [];
        });

        // build groups (keep_together rules + party / group field)
        const groupMap = new Map<string, Set<string>>();
        const groupOf = new Map<string, string>();
        function getGroup(id: string) {
          return groupOf.get(id);
        }
        function makeGroup(ids: string[]) {
          const gid = uid();
          const set = new Set(ids);
          set.forEach((i) => groupOf.set(i, gid));
          groupMap.set(gid, set);
          return gid;
        }
        function mergeInto(target: string, source: string) {
          const a = groupMap.get(target)!;
          const b = groupMap.get(source)!;
          b.forEach((i) => {
            a.add(i);
            groupOf.set(i, target);
          });
          groupMap.delete(source);
        }
        function addToGroup(gid: string, id: string) {
          groupMap.get(gid)!.add(id);
          groupOf.set(id, gid);
        }

        // party field
        const byParty = new Map<string, string[]>();
        guests.forEach((g) => {
          if (g.group) {
            if (!byParty.has(g.group)) byParty.set(g.group, []);
            byParty.get(g.group)!.push(g.id);
          }
        });
        byParty.forEach((ids) => makeGroup(ids));

        // keep_together rules
        rules
          .filter((r) => r.type === "keep_together" && r.guestIds && r.guestIds.length > 1)
          .forEach((r) => {
            const ids = r.guestIds!;
            const existing = ids.map(getGroup).filter(Boolean) as string[];
            if (existing.length === 0) {
              makeGroup(ids);
            } else {
              const target = existing[0];
              ids.forEach((id) => {
                const cur = getGroup(id);
                if (!cur) addToGroup(target, id);
                else if (cur !== target) mergeInto(target, cur);
              });
            }
          });

        // singletons become own groups
        guests.forEach((g) => {
          if (!getGroup(g.id)) makeGroup([g.id]);
        });

        // keep_apart sets
        const apart: Array<Set<string>> = rules
          .filter((r) => r.type === "keep_apart" && r.guestIds && r.guestIds.length > 1)
          .map((r) => new Set(r.guestIds!));

        // VIP / accessibility: tag the front row tables / edge tables
        const rows = parsePattern(state.settings.rowPattern);
        const frontRowIds = new Set<string>();
        const edgeIds = new Set<string>();
        let cursor = 0;
        rows.forEach((count, rIdx) => {
          for (let c = 0; c < count; c++) {
            const t = tables[cursor + c];
            if (!t) continue;
            if (rIdx === 0) frontRowIds.add(t.id);
            if (c === 0 || c === count - 1) edgeIds.add(t.id);
          }
          cursor += count;
        });

        const vipPref = rules.some((r) => r.type === "vip_near_stage");
        const accPref = rules.some((r) => r.type === "accessibility_edge");
        const balanceCompany = rules.some((r) => r.type === "balance_company");

        // sort groups: VIP first if rule active, then larger groups first
        const groups = Array.from(groupMap.entries()).map(([gid, ids]) => {
          const list = [...ids];
          const hasVip = list.some((id) => {
            const g = guests.find((x) => x.id === id);
            return g?.tags.includes("VIP");
          });
          const hasAcc = list.some((id) => {
            const g = guests.find((x) => x.id === id);
            return g?.tags.includes("Wheelchair");
          });
          return { gid, ids: list, hasVip, hasAcc, size: list.length };
        });
        groups.sort((a, b) => {
          if (vipPref && a.hasVip !== b.hasVip) return a.hasVip ? -1 : 1;
          if (accPref && a.hasAcc !== b.hasAcc) return a.hasAcc ? -1 : 1;
          return b.size - a.size;
        });

        function violatesApart(tableId: string, candidateId: string): boolean {
          const here = new Set(occupants[tableId]);
          for (const s of apart) {
            if (!s.has(candidateId)) continue;
            for (const other of s) {
              if (other !== candidateId && here.has(other)) return true;
            }
          }
          return false;
        }

        function scoreTable(tableId: string, group: typeof groups[number]): number {
          let score = 0;
          // capacity must fit
          if (cap[tableId] < group.size) return -Infinity;
          if (vipPref && group.hasVip && frontRowIds.has(tableId)) score += 50;
          if (accPref && group.hasAcc && edgeIds.has(tableId)) score += 30;
          // balance: penalty for repeating company
          if (balanceCompany) {
            const companies = occupants[tableId]
              .map((id) => guests.find((g) => g.id === id)?.company)
              .filter(Boolean) as string[];
            const groupCompanies = group.ids
              .map((id) => guests.find((g) => g.id === id)?.company)
              .filter(Boolean) as string[];
            const overlap = groupCompanies.filter((c) => companies.includes(c)).length;
            score -= overlap * 10;
          }
          // prefer tables with more remaining space (spread groups)
          score += cap[tableId];
          return score;
        }

        let violations = 0;
        for (const group of groups) {
          // pick best table
          let bestId: string | null = null;
          let bestScore = -Infinity;
          for (const t of tables) {
            const s = scoreTable(t.id, group);
            if (s > bestScore) {
              // check apart constraints (hard)
              const ok = group.ids.every((id) => !violatesApart(t.id, id));
              if (ok) {
                bestScore = s;
                bestId = t.id;
              }
            }
          }
          if (!bestId) {
            // place anyway (largest remaining capacity), count violations
            const t = [...tables].sort((a, b) => cap[b.id] - cap[a.id])[0];
            if (cap[t.id] >= group.size) {
              bestId = t.id;
              violations += group.size;
            }
          }
          if (!bestId) continue;
          for (const id of group.ids) {
            occupants[bestId].push(id);
            cap[bestId] -= 1;
          }
        }

        // commit: assign seat indices
        const updated = state.guests.map((g) => ({
          ...g,
          tableId: undefined as string | undefined,
          seatIndex: undefined as number | undefined,
        }));
        let assigned = 0;
        for (const t of tables) {
          occupants[t.id].forEach((id, idx) => {
            const u = updated.find((x) => x.id === id);
            if (u) {
              u.tableId = t.id;
              u.seatIndex = idx + 1;
              assigned += 1;
            }
          });
        }
        set({ guests: updated });
        return { assigned, unassigned: updated.length - assigned, violations };
      },

      importPlan: (data) => set((s) => ({ ...s, ...data })),
    }),
    {
      name: "seating-plan-v1",
    },
  ),
);

export function parseRowPattern(p: string) {
  return parsePattern(p);
}

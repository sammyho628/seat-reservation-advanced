import { create } from "zustand";
import { temporal } from "zundo";
import { useStore } from "zustand";

export type Tag = "VIP" | "Wheelchair" | "Child" | "Speaker" | "Sponsor";
export type Meal = "Chicken" | "Fish" | "Vegetarian" | "Vegan" | "Kids" | "None";
export type RsvpStatus = "Confirmed" | "Pending" | "Declined" | "Waitlist" | "No-show";

export type SeatStrategy =
  | "smart"
  | "spread"
  | "group"
  | "alpha"
  | "random"
  | "vip-first"
  | "sequential"
  | "cohort-first";

export interface Guest {
  id: string;
  firstName?: string;
  lastName?: string;
  name: string;
  company?: string;
  title?: string;
  cohort?: string;
  meal: Meal;
  tags: Tag[];
  dietary?: string;
  notes?: string;
  rsvpStatus: RsvpStatus;
  arrived?: boolean;
  tableId?: string;
  seatIndex?: number;
  locked?: boolean;
}

export interface Table {
  id: string;
  label: string;
  seats: number;
  hostName?: string;
  hostGuestId?: string;
  notes?: string;
  hostTag?: string;
  seatOffset?: number;
}

export type RuleType =
  | "keep_together"
  | "keep_apart"
  | "keep_cohort_together"
  | "vip_near_stage"
  | "accessibility_edge"
  | "balance_company"
  | "seat_adjacent";

export interface Rule {
  id: string;
  type: RuleType;
  guestIds?: string[];
  cohort?: string;
  enabled: boolean;
}

export type NamingScheme =
  | "alpha"
  | "numeric"
  | "numeric-skip13"
  | "numeric-skip4"
  | "numeric-skip-both"
  | "flowers"
  | "colors"
  | "llm-models"
  | "wines"
  | "cities"
  | "constellations";

export interface Settings {
  rowPattern: string;
  defaultSeats: number;
  eventTitle: string;
  primaryColor: string;
  logoDataUrl?: string;
  showStage: boolean;
  namingScheme: NamingScheme;
  showFirmInList: boolean;
}

export const NAMING_VOCAB: Record<NamingScheme, string[] | null> = {
  alpha: null,
  numeric: null,
  "numeric-skip13": null,
  "numeric-skip4": null,
  "numeric-skip-both": null,
  flowers: ["Rose","Lily","Iris","Dahlia","Jasmine","Orchid","Peony","Tulip","Violet","Magnolia","Poppy","Camellia","Lavender","Hibiscus","Lotus","Marigold","Freesia","Wisteria","Begonia","Azalea","Zinnia","Primrose","Aster","Bluebell","Daffodil","Foxglove","Gardenia","Heather","Indigo","Juniper"],
  colors: ["Ivory","Amber","Coral","Sage","Slate","Indigo","Teal","Crimson","Ochre","Sienna","Azure","Cobalt","Emerald","Fuchsia","Goldenrod","Heliotrope","Jade","Khaki","Lavender","Magenta","Navy","Olive","Periwinkle","Quartz","Ruby","Sapphire","Topaz","Umber","Vermilion","Wisteria"],
  "llm-models": ["Claude","GPT","Gemini","Llama","Mistral","Grok","Copilot","Falcon","Phi","Nova","Cohere","Titan","Jurassic","Bloom","Vicuna","Alpaca","Orca","Dolly","Guanaco","Platypus","WizardLM","Zephyr","Qwen","Yi","Mixtral","Gemma","Solar","DeepSeek","Command","Granite"],
  wines: ["Bordeaux","Champagne","Barolo","Rioja","Chablis","Merlot","Malbec","Riesling","Shiraz","Pinot","Chianti","Sancerre","Brunello","Prosecco","Grenache","Viognier","Tempranillo","Moscato","Amarone","Zinfandel","Cabernet","Chardonnay","Sauvignon","Gewurz","Barbera","Montepulciano","Primitivo","Nero","Vermentino","Frascati"],
  cities: ["Paris","Vienna","Kyoto","Lisbon","Bruges","Milan","Havana","Marrakech","Prague","Dubrovnik","Reykjavik","Istanbul","Cape Town","Sydney","Montreal","Buenos Aires","Santorini","Florence","Amsterdam","Barcelona","Edinburgh","Budapest","Valletta","Tallinn","Bern","Salzburg","Porto","Queenstown","Amalfi","Bergen"],
  constellations: ["Orion","Lyra","Cygnus","Draco","Cassiopeia","Aquila","Perseus","Andromeda","Hercules","Pegasus","Leo","Gemini","Taurus","Scorpius","Sagittarius","Capricorn","Aquarius","Pisces","Aries","Libra","Virgo","Cancer","Bootes","Corona","Corvus","Crater","Eridanus","Hydra","Lepus","Lupus"],
};

export function sortKey(g: Guest): string {
  return (g.lastName?.trim() || g.name).toLowerCase();
}

function deriveName(g: Partial<Guest>): string | undefined {
  const fn = g.firstName?.trim();
  const ln = g.lastName?.trim();
  if (fn || ln) return [fn, ln].filter(Boolean).join(" ");
  return undefined;
}

interface PlanState {
  settings: Settings;
  tables: Table[];
  guests: Guest[];
  rules: Rule[];

  setSettings: (patch: Partial<Settings>) => void;
  regenerateTables: () => void;
  updateTable: (id: string, patch: Partial<Table>) => void;
  reorderTables: (orderedIds: string[]) => void;
  applyNamingScheme: (scheme: NamingScheme) => void;
  setTableHost: (tableId: string, guestId: string | undefined) => void;
  rotateTable: (tableId: string, direction: "cw" | "ccw") => void;
  addTable: () => void;
  removeTable: (tableId: string) => void;

  addGuests: (guests: Omit<Guest, "id">[]) => void;
  updateGuest: (id: string, patch: Partial<Guest>) => void;
  removeGuest: (id: string) => void;
  clearGuests: () => void;
  setGuestArrived: (guestId: string, arrived: boolean) => void;

  assignGuest: (guestId: string, tableId: string, seatIndex?: number) => void;
  unassignGuest: (guestId: string) => void;
  swapSeats: (
    a: { tableId: string; seatIndex: number },
    b: { tableId: string; seatIndex: number },
  ) => void;

  addRule: (rule: Omit<Rule, "id">) => void;
  updateRule: (id: string, patch: Partial<Rule>) => void;
  removeRule: (id: string) => void;

  autoSeat: (strategy?: SeatStrategy, commit?: boolean) => {
    assigned: number;
    unassigned: number;
    violations: number;
    violatingGuestIds: string[];
  };
  resetAssignments: () => void;
  importPlan: (data: Partial<PlanState>) => boolean;
}

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

function letterLabel(i: number): string {
  let s = "";
  let n = i;
  do {
    s = String.fromCharCode(65 + (n % 26)) + s;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return s;
}

function getNumericLabel(index: number, scheme: NamingScheme): number {
  let n = 0;
  let i = 0;
  while (i <= index) {
    n++;
    const s = String(n);
    if (scheme === "numeric-skip13" && n === 13) continue;
    if (scheme === "numeric-skip4" && s.includes("4")) continue;
    if (scheme === "numeric-skip-both" && (n === 13 || s.includes("4"))) continue;
    i++;
  }
  return n;
}

function labelFor(i: number, scheme: NamingScheme): string {
  if (scheme === "alpha") return letterLabel(i);
  if (scheme.startsWith("numeric")) return String(getNumericLabel(i, scheme));
  const vocab = NAMING_VOCAB[scheme];
  return vocab?.[i] ?? letterLabel(i);
}

function parsePattern(pattern: string): number[] {
  return pattern
    .split(":")
    .map((s) => parseInt(s.trim(), 10))
    .filter((n) => Number.isFinite(n) && n > 0);
}

function buildTables(pattern: string, defaultSeats: number, existing: Table[], scheme: NamingScheme): Table[] {
  const rows = parsePattern(pattern);
  const total = rows.reduce((a, b) => a + b, 0);
  const out: Table[] = [];
  for (let i = 0; i < total; i++) {
    const prev = existing[i];
    out.push({
      id: prev?.id ?? uid(),
      label: prev?.label ?? labelFor(i, scheme),
      seats: prev?.seats ?? defaultSeats,
      hostName: prev?.hostName,
      hostGuestId: prev?.hostGuestId,
      notes: prev?.notes,
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
  namingScheme: "alpha",
  showFirmInList: false,
};

export const usePlanStore = create<PlanState>()(
  temporal(
    (set, get) => ({
      settings: initialSettings,
      tables: buildTables(initialSettings.rowPattern, initialSettings.defaultSeats, [], initialSettings.namingScheme),
      guests: [],
      rules: [],

      setSettings: (patch) => {
        set((s) => ({ settings: { ...s.settings, ...patch } }));
        if (patch.rowPattern !== undefined || patch.defaultSeats !== undefined) {
          set((s) => ({
            tables: buildTables(s.settings.rowPattern, s.settings.defaultSeats, s.tables, s.settings.namingScheme),
          }));
        }
      },

      regenerateTables: () =>
        set((s) => ({
          tables: buildTables(s.settings.rowPattern, s.settings.defaultSeats, s.tables, s.settings.namingScheme),
        })),

      updateTable: (id, patch) =>
        set((s) => ({ tables: s.tables.map((t) => (t.id === id ? { ...t, ...patch } : t)) })),

      reorderTables: (orderedIds) =>
        set((s) => {
          const byId = new Map(s.tables.map((t) => [t.id, t]));
          const next = orderedIds.map((id) => byId.get(id)).filter(Boolean) as Table[];
          s.tables.forEach((t) => {
            if (!orderedIds.includes(t.id)) next.push(t);
          });
          return { tables: next };
        }),

      applyNamingScheme: (scheme) =>
        set((s) => {
          const tables = s.tables.map((t, i) => ({ ...t, label: labelFor(i, scheme) }));
          return { tables, settings: { ...s.settings, namingScheme: scheme } };
        }),

      setTableHost: (tableId, guestId) =>
        set((s) => ({
          tables: s.tables.map((t) => (t.id === tableId ? { ...t, hostGuestId: guestId } : t)),
        })),

      rotateTable: (tableId, direction) =>
        set((s) => {
          const table = s.tables.find((t) => t.id === tableId);
          if (!table) return s;
          const n = table.seats;
          return {
            guests: s.guests.map((g) => {
              if (g.tableId !== tableId || !g.seatIndex) return g;
              const next =
                direction === "cw"
                  ? (g.seatIndex % n) + 1
                  : ((g.seatIndex - 2 + n) % n) + 1;
              return { ...g, seatIndex: next };
            }),
          };
        }),

      addGuests: (guests) =>
        set((s) => ({
          guests: [
            ...s.guests,
            ...guests.map((g) => {
              const derived = deriveName(g);
              return {
                ...(g as any),
                name: derived ?? g.name ?? "",
                rsvpStatus: g.rsvpStatus ?? "Confirmed",
                id: uid(),
              } as Guest;
            }),
          ],
        })),

      updateGuest: (id, patch) =>
        set((s) => ({
          guests: s.guests.map((g) => {
            if (g.id !== id) return g;
            const merged = { ...g, ...patch };
            if (patch.firstName !== undefined || patch.lastName !== undefined) {
              const derived = deriveName(merged);
              if (derived) merged.name = derived;
            }
            return merged;
          }),
        })),

      removeGuest: (id) =>
        set((s) => ({
          guests: s.guests.filter((g) => g.id !== id),
          tables: s.tables.map((t) => (t.hostGuestId === id ? { ...t, hostGuestId: undefined } : t)),
        })),
      clearGuests: () =>
        set((s) => ({
          guests: [],
          tables: s.tables.map((t) => ({ ...t, hostGuestId: undefined })),
        })),

      setGuestArrived: (guestId, arrived) =>
        set((s) => ({ guests: s.guests.map((g) => (g.id === guestId ? { ...g, arrived } : g)) })),

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
          if (!seat) return s;
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

      autoSeat: (strategy = "smart", commit = true) => {
        const state = get();
        const tables = state.tables.map((t) => ({ ...t }));
        const eligible = state.guests.filter(
          (g) => g.rsvpStatus !== "Declined" && g.rsvpStatus !== "No-show",
        );
        let guests = eligible.map((g) => ({ ...g, tableId: undefined, seatIndex: undefined as number | undefined }));
        const rules = state.rules.filter((r) => r.enabled);

        // strategy ordering for singletons
        if (strategy === "alpha") {
          guests.sort((a, b) => sortKey(a as Guest).localeCompare(sortKey(b as Guest)));
        } else if (strategy === "random") {
          for (let i = guests.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [guests[i], guests[j]] = [guests[j], guests[i]];
          }
        }

        const cap: Record<string, number> = {};
        const occupants: Record<string, string[]> = {};
        tables.forEach((t) => {
          cap[t.id] = t.seats;
          occupants[t.id] = [];
        });

        const groupMap = new Map<string, Set<string>>();
        const groupOf = new Map<string, string>();
        const getGroup = (id: string) => groupOf.get(id);
        function makeGroup(ids: string[]) {
          const gid = uid();
          const s = new Set(ids);
          s.forEach((i) => groupOf.set(i, gid));
          groupMap.set(gid, s);
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

        const byCohort = new Map<string, string[]>();
        guests.forEach((g) => {
          if (g.cohort) {
            if (!byCohort.has(g.cohort)) byCohort.set(g.cohort, []);
            byCohort.get(g.cohort)!.push(g.id);
          }
        });
        byCohort.forEach((ids) => makeGroup(ids));

        rules.filter((r) => r.type === "keep_cohort_together" && r.cohort).forEach((r) => {
          const ids = byCohort.get(r.cohort!) ?? [];
          if (ids.length > 1) {
            const existing = ids.map(getGroup).filter(Boolean) as string[];
            if (existing.length === 0) makeGroup(ids);
            else {
              const target = existing[0];
              ids.forEach((id) => {
                const cur = getGroup(id);
                if (!cur) addToGroup(target, id);
                else if (cur !== target) mergeInto(target, cur);
              });
            }
          }
        });

        rules
          .filter((r) => r.type === "keep_together" && r.guestIds && r.guestIds.length > 1)
          .forEach((r) => {
            const ids = r.guestIds!.filter((id) => guests.some((g) => g.id === id));
            if (ids.length < 2) return;
            const existing = ids.map(getGroup).filter(Boolean) as string[];
            if (existing.length === 0) makeGroup(ids);
            else {
              const target = existing[0];
              ids.forEach((id) => {
                const cur = getGroup(id);
                if (!cur) addToGroup(target, id);
                else if (cur !== target) mergeInto(target, cur);
              });
            }
          });

        // group strategy: bind same-company guests
        if (strategy === "group") {
          const byCompany = new Map<string, string[]>();
          guests.forEach((g) => {
            if (g.company) {
              if (!byCompany.has(g.company)) byCompany.set(g.company, []);
              byCompany.get(g.company)!.push(g.id);
            }
          });
          byCompany.forEach((ids) => {
            if (ids.length < 2) return;
            const existing = ids.map(getGroup).filter(Boolean) as string[];
            if (existing.length === 0) makeGroup(ids);
            else {
              const target = existing[0];
              ids.forEach((id) => {
                const cur = getGroup(id);
                if (!cur) addToGroup(target, id);
                else if (cur !== target) mergeInto(target, cur);
              });
            }
          });
        }

        guests.forEach((g) => {
          if (!getGroup(g.id)) makeGroup([g.id]);
        });

        const apart: Array<Set<string>> = rules
          .filter((r) => r.type === "keep_apart" && r.guestIds && r.guestIds.length > 1)
          .map((r) => new Set(r.guestIds!));

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

        const vipPref = rules.some((r) => r.type === "vip_near_stage") || strategy === "vip-first";
        const accPref = rules.some((r) => r.type === "accessibility_edge");
        const balanceCompany = rules.some((r) => r.type === "balance_company") || strategy === "spread";
        const companyPenalty = strategy === "spread" ? 20 : 10;
        const companyBonus = strategy === "group" ? 20 : 0;

        let groups = Array.from(groupMap.entries()).map(([gid, ids]) => {
          const list = [...ids];
          const hasVip = list.some((id) => guests.find((x) => x.id === id)?.tags.includes("VIP"));
          const hasAcc = list.some((id) => guests.find((x) => x.id === id)?.tags.includes("Wheelchair"));
          const isCohort = list.length > 1 && list.every((id) => {
            const g = guests.find((x) => x.id === id);
            return !!g?.cohort;
          });
          return { gid, ids: list, hasVip, hasAcc, isCohort, size: list.length };
        });

        if (strategy === "cohort-first") {
          groups.sort((a, b) => {
            if (a.isCohort !== b.isCohort) return a.isCohort ? -1 : 1;
            return b.size - a.size;
          });
        } else {
          groups.sort((a, b) => {
            if (vipPref && a.hasVip !== b.hasVip) return a.hasVip ? -1 : 1;
            if (accPref && a.hasAcc !== b.hasAcc) return a.hasAcc ? -1 : 1;
            return b.size - a.size;
          });
        }

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
          if (cap[tableId] < group.size) return -Infinity;
          if (vipPref && group.hasVip && frontRowIds.has(tableId)) score += strategy === "vip-first" ? 100 : 50;
          if (accPref && group.hasAcc && edgeIds.has(tableId)) score += 30;
          if (balanceCompany || companyBonus) {
            const companies = occupants[tableId]
              .map((id) => guests.find((g) => g.id === id)?.company)
              .filter(Boolean) as string[];
            const groupCompanies = group.ids
              .map((id) => guests.find((g) => g.id === id)?.company)
              .filter(Boolean) as string[];
            const overlap = groupCompanies.filter((c) => companies.includes(c)).length;
            if (companyBonus) score += overlap * companyBonus;
            else score -= overlap * companyPenalty;
          }
          score += cap[tableId];
          return score;
        }

        const violatingGuestIds: string[] = [];
        for (const group of groups) {
          let bestId: string | null = null;

          if (strategy === "sequential") {
            const t = tables.find((t) => cap[t.id] >= group.size);
            if (t) bestId = t.id;
          } else {
            let bestScore = -Infinity;
            for (const t of tables) {
              const s = scoreTable(t.id, group);
              if (s > bestScore) {
                const ok = group.ids.every((id) => !violatesApart(t.id, id));
                if (ok) {
                  bestScore = s;
                  bestId = t.id;
                }
              }
            }
          }
          if (!bestId) {
            const t = [...tables].sort((a, b) => cap[b.id] - cap[a.id])[0];
            if (t && cap[t.id] >= group.size) {
              bestId = t.id;
              violatingGuestIds.push(...group.ids);
            }
          }
          if (!bestId) continue;
          for (const id of group.ids) {
            occupants[bestId].push(id);
            cap[bestId] -= 1;
          }
        }

        const updated = state.guests.map((g) => ({
          ...g,
          tableId: g.rsvpStatus === "Declined" || g.rsvpStatus === "No-show" ? undefined : (undefined as string | undefined),
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
        if (commit) set({ guests: updated });
        return {
          assigned,
          unassigned: eligible.length - assigned,
          violations: violatingGuestIds.length,
          violatingGuestIds,
        };
      },

      importPlan: (data) => {
        if (!data || typeof data !== "object") return false;
        if (data.tables && !Array.isArray(data.tables)) return false;
        if (data.guests && !Array.isArray(data.guests)) return false;
        if (data.rules && !Array.isArray(data.rules)) return false;
        set((s) => ({
          settings: { ...s.settings, ...(data.settings ?? {}) },
          tables: data.tables ?? s.tables,
          guests: (data.guests ?? []).map((g: any) => ({
            rsvpStatus: "Confirmed" as RsvpStatus,
            tags: [],
            meal: "None" as Meal,
            ...g,
          })),
          rules: data.rules ?? [],
        }));
        return true;
      },
    }),
    { limit: 50, partialize: (s) => ({ settings: s.settings, tables: s.tables, guests: s.guests, rules: s.rules }) as any },
  ),
);

export const useTemporalStore = <T,>(selector: (state: any) => T) =>
  useStore(usePlanStore.temporal as any, selector);

const STORAGE_KEY = "seating-plan-v2";

function applyPrimary(hex: string) {
  try {
    document.documentElement.style.setProperty("--primary", hex);
    const m = hex.replace("#", "");
    if (m.length >= 6) {
      const r = parseInt(m.slice(0, 2), 16) / 255;
      const g = parseInt(m.slice(2, 4), 16) / 255;
      const b = parseInt(m.slice(4, 6), 16) / 255;
      const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      document.documentElement.style.setProperty(
        "--primary-foreground",
        lum < 0.5 ? "#ffffff" : "#111111",
      );
    }
  } catch {}
}

if (typeof window !== "undefined") {
  try {
    const v1 = window.localStorage.getItem("seating-plan-v1");
    if (v1 && !window.localStorage.getItem(STORAGE_KEY)) {
      const data = JSON.parse(v1);
      if (data.guests) {
        data.guests = data.guests.map((g: any) => {
          const { group, ...rest } = g;
          return { ...rest, cohort: group, rsvpStatus: g.rsvpStatus ?? "Confirmed" };
        });
      }
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    }
    window.localStorage.removeItem("seating-plan-v1");
  } catch {}

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const data = JSON.parse(raw) as Partial<PlanState>;
      usePlanStore.setState({
        settings: { ...usePlanStore.getState().settings, ...(data.settings ?? {}) },
        tables: data.tables ?? usePlanStore.getState().tables,
        guests: (data.guests ?? []).map((g: any) => ({
          rsvpStatus: "Confirmed" as RsvpStatus,
          tags: [],
          meal: "None" as Meal,
          firstName: g.firstName,
          lastName: g.lastName,
          ...g,
        })),
        rules: data.rules ?? [],
      });
    }
  } catch {}

  applyPrimary(usePlanStore.getState().settings.primaryColor);

  let timer: ReturnType<typeof setTimeout> | undefined;
  let lastSavedAt = 0;
  const listeners = new Set<(t: number) => void>();
  (window as any).__seatcraftOnSave = (cb: (t: number) => void) => {
    listeners.add(cb);
    return () => listeners.delete(cb);
  };
  (window as any).__seatcraftLastSaved = () => lastSavedAt;

  usePlanStore.subscribe((s) => {
    applyPrimary(s.settings.primaryColor);
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      try {
        window.localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({
            settings: s.settings,
            tables: s.tables,
            guests: s.guests,
            rules: s.rules,
          }),
        );
        lastSavedAt = Date.now();
        listeners.forEach((cb) => cb(lastSavedAt));
      } catch {}
    }, 150);
  });
}

export function parseRowPattern(p: string) {
  return parsePattern(p);
}

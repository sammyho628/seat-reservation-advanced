import { create } from "zustand";
import { usePlanStore, type Guest, type Rule, type Settings, type Table, type FloorPlan } from "./plan-store";
import {
  PLAN_LOAD_URL,
  PLAN_SAVE_URL,
  AUTO_SAVE_DEBOUNCE_MS,
  BACKGROUND_POLL_MS,
  OFFLINE_CACHE_KEY,
} from "./plan-sync-config";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface PlanBody {
  settings: Settings;
  tables: Table[];
  guests: Guest[];
  rules: Rule[];
  floorPlan: FloorPlan;
}

export interface RemoteSnapshot {
  lastModified: string;
  version: number;
  plan: PlanBody;
}

export type SyncStatus =
  | "idle"
  | "loading"
  | "saving"
  | "saved"
  | "offline"
  | "conflict"
  | "error";

interface SyncState {
  status: SyncStatus;
  lastLoadedAt?: number;
  lastSavedAt?: number;
  offlineFallback: boolean;
  offlineSnapshotAt?: number;
  bootstrapped: boolean;
  /** Version we based the current in-memory state on. New saves send this and receive an incremented version back. */
  baseVersion: number;
  baseLastModified?: string;
  /** Populated when a save returns 409 or a reload finds a newer server version than ours. */
  conflict?: { remote: RemoteSnapshot };
  reload: () => Promise<void>;
  resolveConflict: (action: "reload" | "overwrite") => Promise<void>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Store
// ─────────────────────────────────────────────────────────────────────────────

export const useSyncStore = create<SyncState>((set, get) => ({
  status: "idle",
  offlineFallback: false,
  bootstrapped: false,
  baseVersion: 0,
  reload: async () => {
    await loadRemote();
  },
  resolveConflict: async (action) => {
    const c = get().conflict;
    if (!c) return;
    if (action === "reload") {
      applySnapshot(c.remote);
      set({ conflict: undefined, status: "saved", offlineFallback: false });
    } else {
      // Overwrite: bump our base to the server's version so the next save wins
      set({
        conflict: undefined,
        baseVersion: c.remote.version,
        baseLastModified: c.remote.lastModified,
      });
      await flushSave(true);
    }
  },
}));

// ─────────────────────────────────────────────────────────────────────────────
// Internal helpers
// ─────────────────────────────────────────────────────────────────────────────

function currentPlanBody(): PlanBody {
  const s = usePlanStore.getState();
  return {
    settings: s.settings,
    tables: s.tables,
    guests: s.guests,
    rules: s.rules,
    floorPlan: s.floorPlan,
  };
}

function writeOfflineCache(snapshot: RemoteSnapshot) {
  try {
    window.localStorage.setItem(OFFLINE_CACHE_KEY, JSON.stringify(snapshot));
  } catch {}
}

function readOfflineCache(): RemoteSnapshot | null {
  try {
    const raw = window.localStorage.getItem(OFFLINE_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && parsed.plan) return parsed as RemoteSnapshot;
  } catch {}
  return null;
}

/** Skip auto-save for programmatic state changes (e.g. remote load). */
let suppressAutoSave = false;

function applySnapshot(snap: RemoteSnapshot) {
  suppressAutoSave = true;
  try {
    usePlanStore.getState().applyRemotePlan(snap.plan);
    try {
      (usePlanStore as any).temporal.getState().clear();
    } catch {}
  } finally {
    // release on next tick so the subscribe callback (fires synchronously) skips
    setTimeout(() => {
      suppressAutoSave = false;
    }, 0);
  }
  useSyncStore.setState({
    baseVersion: snap.version,
    baseLastModified: snap.lastModified,
    lastLoadedAt: Date.now(),
    offlineFallback: false,
  });
  writeOfflineCache(snap);
}

/**
 * Coerce a variety of tolerated JSON shapes into a RemoteSnapshot, so a hand-
 * edited or freshly-created server file with just the bare plan still works.
 */
function coerceSnapshot(raw: any): RemoteSnapshot | null {
  if (!raw || typeof raw !== "object") return null;
  // Case A: already the {lastModified, version, plan} envelope
  if (raw.plan && typeof raw.plan === "object") {
    return {
      lastModified: String(raw.lastModified ?? new Date().toISOString()),
      version: Number.isFinite(raw.version) ? Number(raw.version) : 1,
      plan: normalizePlan(raw.plan),
    };
  }
  // Case B: the raw plan itself (no envelope)
  if (raw.settings || raw.tables || raw.guests) {
    return {
      lastModified: new Date().toISOString(),
      version: 1,
      plan: normalizePlan(raw),
    };
  }
  return null;
}

function normalizePlan(p: any): PlanBody {
  return {
    settings: p.settings ?? ({} as Settings),
    tables: Array.isArray(p.tables) ? p.tables : [],
    guests: Array.isArray(p.guests) ? p.guests : [],
    rules: Array.isArray(p.rules) ? p.rules : [],
    floorPlan: p.floorPlan ?? {
      backgroundOpacity: 0.55,
      markers: [],
      tablePositions: {},
      tableShapes: {},
      tableVip: {},
    },
  };
}

async function loadRemote(): Promise<void> {
  useSyncStore.setState({ status: "loading" });
  try {
    const url = `${PLAN_LOAD_URL}${PLAN_LOAD_URL.includes("?") ? "&" : "?"}t=${Date.now()}`;
    const res = await fetch(url, { cache: "no-store", credentials: "omit" });
    if (!res.ok) {
      // 404 with no plan on server yet is fine — treat as empty baseline
      if (res.status === 404) {
        useSyncStore.setState({
          status: "saved",
          bootstrapped: true,
          offlineFallback: false,
          baseVersion: 0,
        });
        return;
      }
      throw new Error(`HTTP ${res.status}`);
    }
    const raw = await res.json();
    const snap = coerceSnapshot(raw);
    if (!snap) throw new Error("Remote JSON did not look like a Seatcraft plan");
    applySnapshot(snap);
    useSyncStore.setState({ status: "saved", bootstrapped: true, offlineFallback: false });
  } catch (err) {
    console.warn("[plan-sync] load failed:", err);
    const cached = readOfflineCache();
    if (cached) {
      applySnapshot(cached);
      useSyncStore.setState({
        status: "offline",
        bootstrapped: true,
        offlineFallback: true,
        offlineSnapshotAt: cached ? Date.parse(cached.lastModified) || Date.now() : undefined,
      });
    } else {
      useSyncStore.setState({
        status: "offline",
        bootstrapped: true,
        offlineFallback: true,
      });
    }
  }
}

let saveInFlight = false;
let pendingSave = false;

async function flushSave(force = false): Promise<void> {
  if (!useSyncStore.getState().bootstrapped) return;
  if (useSyncStore.getState().conflict && !force) return;
  if (saveInFlight) {
    pendingSave = true;
    return;
  }
  saveInFlight = true;
  useSyncStore.setState({ status: "saving" });
  const base = useSyncStore.getState();
  const now = new Date().toISOString();
  const body = {
    lastModified: base.baseLastModified ?? now,
    version: base.baseVersion,
    plan: currentPlanBody(),
  };
  try {
    const res = await fetch(PLAN_SAVE_URL, {
      method: "POST",
      cache: "no-store",
      credentials: "omit",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.status === 409) {
      const remoteJson = await res.json().catch(() => null);
      const remote = coerceSnapshot(remoteJson);
      if (remote) {
        useSyncStore.setState({ status: "conflict", conflict: { remote } });
      } else {
        useSyncStore.setState({ status: "error" });
      }
      return;
    }
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const savedRaw = await res.json().catch(() => null);
    const nextVersion =
      savedRaw && Number.isFinite(savedRaw.version) ? Number(savedRaw.version) : base.baseVersion + 1;
    const nextLastModified =
      savedRaw && typeof savedRaw.lastModified === "string" ? savedRaw.lastModified : now;
    const snapshot: RemoteSnapshot = {
      lastModified: nextLastModified,
      version: nextVersion,
      plan: body.plan,
    };
    writeOfflineCache(snapshot);
    useSyncStore.setState({
      status: "saved",
      lastSavedAt: Date.now(),
      baseVersion: nextVersion,
      baseLastModified: nextLastModified,
      offlineFallback: false,
    });
  } catch (err) {
    console.warn("[plan-sync] save failed:", err);
    // Keep offline copy up to date so a reload doesn't lose edits
    const snapshot: RemoteSnapshot = {
      lastModified: base.baseLastModified ?? now,
      version: base.baseVersion,
      plan: body.plan,
    };
    writeOfflineCache(snapshot);
    useSyncStore.setState({ status: "offline", offlineFallback: true });
  } finally {
    saveInFlight = false;
    if (pendingSave) {
      pendingSave = false;
      // schedule another save immediately for the edits that arrived while we were flying
      void flushSave();
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Bootstrap — call once from the client
// ─────────────────────────────────────────────────────────────────────────────

let bootstrapped = false;

export function bootstrapPlanSync() {
  if (typeof window === "undefined" || bootstrapped) return;
  bootstrapped = true;

  // Kick off the initial load
  void loadRemote();

  // Debounced auto-save on any plan change
  let timer: ReturnType<typeof setTimeout> | undefined;
  usePlanStore.subscribe(() => {
    if (suppressAutoSave) return;
    if (!useSyncStore.getState().bootstrapped) return;
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      void flushSave();
    }, AUTO_SAVE_DEBOUNCE_MS);
  });

  // Background nudge to spot changes from other devices
  if (BACKGROUND_POLL_MS > 0) {
    setInterval(async () => {
      if (useSyncStore.getState().status === "saving") return;
      if (useSyncStore.getState().conflict) return;
      try {
        const url = `${PLAN_LOAD_URL}${PLAN_LOAD_URL.includes("?") ? "&" : "?"}t=${Date.now()}`;
        const res = await fetch(url, { cache: "no-store", credentials: "omit" });
        if (!res.ok) return;
        const snap = coerceSnapshot(await res.json());
        if (!snap) return;
        const base = useSyncStore.getState();
        if (snap.version > base.baseVersion) {
          useSyncStore.setState({ status: "conflict", conflict: { remote: snap } });
        }
      } catch {
        /* silent — dev network hiccups shouldn't spam toasts */
      }
    }, BACKGROUND_POLL_MS);
  }

  // Flush any pending save on unload so a page refresh doesn't lose edits
  window.addEventListener("beforeunload", () => {
    if (timer) {
      clearTimeout(timer);
      void flushSave();
    }
  });
}

export function reloadPlan() {
  return useSyncStore.getState().reload();
}

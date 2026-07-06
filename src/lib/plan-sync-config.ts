// -----------------------------------------------------------------------------
// Shared JSON storage endpoints for Seatcraft.
// Replace the two placeholder URLs below with your actual IIS / ASP.NET endpoints.
//
//   PLAN_LOAD_URL — GET returning JSON of the form:
//     { "lastModified": "2026-07-06T09:12:00.000Z", "version": 7, "plan": { ... } }
//     (or an empty file — see fetchRemotePlan for the tolerated shapes)
//
//   PLAN_SAVE_URL — POST accepts JSON of the form:
//     { "lastModified": "…", "version": 7, "plan": { ... } }
//     - 200 OK with body { "lastModified": "…", "version": 8 } on success
//     - 409 Conflict with body { "lastModified": "…", "version": 8, "plan": { ... } }
//       when the server has a newer version than what this client based its edit on
//
// Both endpoints must send permissive CORS headers because Seatcraft is served
// from a different origin than the JSON server.
// -----------------------------------------------------------------------------

export const PLAN_LOAD_URL = "https://REPLACE-ME.example.com/seatcraft/plan.json";
export const PLAN_SAVE_URL = "https://REPLACE-ME.example.com/seatcraft/save-plan";

/** Debounce window between an edit and the resulting POST to PLAN_SAVE_URL. */
export const AUTO_SAVE_DEBOUNCE_MS = 1500;

/** How often to background-refresh from PLAN_LOAD_URL. Set 0 to disable. */
export const BACKGROUND_POLL_MS = 30_000;

/** localStorage key for the last successfully loaded remote snapshot (offline fallback only). */
export const OFFLINE_CACHE_KEY = "seatcraft-offline-cache-v1";

/** localStorage key for the device's staff name used when adding walk-in guests. */
export const STAFF_NAME_KEY = "seatcraft-staff-name";

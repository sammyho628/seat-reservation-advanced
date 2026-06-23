## Corporate Event Seating Planner — MVP Plan

A polished single-page app designed for high-stakes professional events, summits, and corporate luncheons. It features a responsive floor grid, advanced guest list management with smart import reconciliation, and rule-based auto-seating tailored for corporate networking.

Stays local-first (no login, no backend). Data autosaves to the browser. Pure frontend — fast, shareable, and immediate.

### Screens

- **Planner (home,** `/`**)** — The floor grid, intelligent drag-and-drop sidebar, top toolbar, and branding configuration.
- **Guests (**`/guests`**)** — Guest table with smart import/reconciliation, search, bulk edit, tags, and continuous triage.
- **Rules (**`/rules`**)** — UI builder for auto-seating constraints (affinities, anti-affinities, and balancing).
- **Export/Print (**`/print`**)** — Dedicated layouts for physical printing, kitchen ops, and direct PNG generation for presentation decks.

### Feature Set

#### 1. Floor Grid & Visual Triage

- **Grid Layout:** Tables per row input (e.g., 4:3:3:4) and default seats per table.
- **Table Metadata:** Per-table override for Name, Seat Count, and a "Table Host/Sponsor" tag (which restricts auto-seating to that sponsor's network).
- **Advanced Numbering:** Support for a standard "Seat Index" (1–12) and a customized "Seat Label" (e.g., VIP-1, 12A).
- **Visual Triage Icons:** Inline map indicators so users don't have to click to see status. Include a star for VIP, color-coded dots for dietary needs, and a red warning triangle for rule violations.
- **Kitchen & Operations Toggle:** A high-contrast view that strips away guest names and displays only massive dietary icons and meal counts per table for catering staff.
- **Drag & Swap:** Click-to-swap or drag-to-swap seats (works between tables).
- **Views:** "Overall Ballroom" and "Single Table" toggle. Stage marker on row 1.

#### 2. Guest List, Import & Reconciliation

- **Columns:** Name, Firm/Company, Title, Tags (Buy-Side, Sell-Side, VIP, Wheelchair), Dietary Restrictions, Table (assigned), Seat Label.
- **Smart Import:** Import CSV/Excel via SheetJS. Includes a "fuzzy" column-mapping dialog that auto-detects common headers (e.g., mapping "Allergy" or "Food" to the Dietary field).
- **Continuous Triage (Re-import):** When uploading an updated guest list, the system reconciles changes against the current board. It highlights "New Guests," "Removed Guests," and "Changed Dietary Needs" without wiping existing table assignments.
- **Bulk Actions:** Shift-click multiple guests to assign them to a specific table instantly. Inline edit, bulk delete, search, and filter.

#### 3. Rule-Based Auto-Seating & Intelligent Sidebar

- **Intelligent Sidebar:** The unassigned guest list floats on the Planner. Selecting a specific table auto-filters the sidebar to show guests matching that table's "Host/Sponsor" tag at the top.
- **Rule Builder (UI, no SQL):**
  - *Keep Together:* Sponsor guests sit at their assigned sponsor table.
  - *Competitor Separation (Anti-Affinity):* Prevent tagged competitors from sitting at the same or adjacent tables.
  - *VIP Routing:* VIP tags prefer specified front rows or premium tables.
  - *Firm/Title Balancing:* Ensure no table is overloaded with guests from the exact same firm; mix industry sectors (e.g., balance Buy-Side and Sell-Side) for optimal networking.
  - *Accessibility:* Wheelchair tags prefer aisle/edge tables.
- **Solver & Conflict UI:** Runs via Web Worker to keep the UI smooth. Highlights soft vs. hard constraints. If a rule cannot be met, conflicting guests are highlighted in red on the map, allowing for manual drag-and-drop overrides.

#### 4. Branding, Export & Persistence

- **Branding Configuration:** Settings modal to define a primary hex theme color, upload an event logo, and set an event title.
- **One-Click PNG Export:** Uses `html2canvas` to snap a high-res image of the seating map (complete with branding and legend) for immediate pasting into PPT or emails.
- **Persistence:** Autosave full state (tables, guests, rules, branding) to `localStorage`.
- **Plan Management:** "New Plan / Duplicate / Reset" menu. Full JSON export/import of the plan state for backups and sharing.
- **Print Views:** Overall map, per-table guest sheets, alphabetical lookup (Guest → Table), and dietary totals for the kitchen.

### Tech Notes (For the AI / Developer)

- **Framework:** TanStack Start, file-based routes (`index.tsx`, `guests.tsx`, `rules.tsx`, `print.tsx`).
- **State Management:** Single Zustand store (`usePlanStore`) persisted to `localStorage`. Shapes: `Table[]`, `Guest[]`, `Rule[]`, `Settings`.
- **Interactions:** `@dnd-kit/core` for seat ↔ seat and guest → seat drag-and-drop.
- **Data Handling:** `xlsx` (SheetJS) for Excel import/export; `papaparse` for CSV.
- **Image Generation:** `html2canvas` for the PNG export feature.
- **Solver:** Auto-seat solver in `src/workers/seater.worker.ts` (Web Worker). Algorithm: greedy fill for hard constraints (sponsors, anti-affinity) → simulated-annealing for soft rules (networking balance).
- **Styling & Design:** Clean, corporate editorial aesthetic. Serif display for table letters, mono for seat numbers, soft neutral surfaces. Custom tokens in `src/styles.css`.

### Deliverables Checklist


|                      |                                                                                     |
| -------------------- | ----------------------------------------------------------------------------------- |
| **Feature**          | **Description**                                                                     |
| **Planner UI**       | Interactive grid, branding config, visual triage icons, Kitchen View toggle.        |
| **Guest Management** | CSV/Excel import, fuzzy column mapping, re-import reconciliation, bulk edit.        |
| **Auto-Seater**      | Web Worker solver, firm balancing, competitor separation, conflict UI highlighting. |
| **Export Options**   | Print CSS layouts and one-click PNG export with event logo and legend.              |
| **Data Persistence** | `localStorage` autosave and JSON state import/export.                               |

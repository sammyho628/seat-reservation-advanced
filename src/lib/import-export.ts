import * as XLSX from "xlsx";
import Papa from "papaparse";
import type { Guest, Meal, RsvpStatus, Table, Tag } from "./plan-store";

export type GuestDraft = Omit<Guest, "id">;

const HEADER_ALIASES: Record<string, string[]> = {
  firstName: ["first name", "firstname", "given name", "first"],
  lastName: ["last name", "lastname", "surname", "family name", "last"],
  name: ["name", "guest", "guest name", "full name", "combined name", "attendee"],
  company: ["company", "firm", "organization", "org", "employer"],
  title: ["title", "role", "position", "job"],
  cohort: ["cohort", "group", "party", "table group", "sponsor", "panel"],
  meal: ["meal", "menu", "entree", "food"],
  tags: ["tags", "tag", "labels"],
  dietary: ["dietary", "diet", "allergy", "allergies", "restrictions"],
  notes: ["notes", "note", "comment", "comments"],
  rsvpStatus: ["rsvp", "rsvp status", "status", "attendance"],
};

function normalizeMeal(v: string | undefined): Meal {
  if (!v) return "None";
  const s = v.toLowerCase().trim();
  if (s.includes("chick")) return "Chicken";
  if (s.includes("fish") || s.includes("salm")) return "Fish";
  if (s.includes("vegan")) return "Vegan";
  if (s.includes("veg")) return "Vegetarian";
  if (s.includes("kid") || s.includes("child")) return "Kids";
  return "None";
}

function normalizeRsvp(v: string | undefined): RsvpStatus {
  if (!v) return "Confirmed";
  const s = v.toLowerCase().trim();
  if (s.startsWith("conf") || s === "yes" || s === "y" || s.includes("attend")) return "Confirmed";
  if (s.startsWith("pend") || s === "maybe") return "Pending";
  if (s.startsWith("dec") || s === "no" || s === "n" || s.includes("not")) return "Declined";
  if (s.startsWith("wait")) return "Waitlist";
  if (s.includes("no-show") || s.includes("noshow")) return "No-show";
  return "Confirmed";
}

function normalizeTags(v: string | undefined): Tag[] {
  if (!v) return [];
  const parts = v.split(/[,;|]/).map((p) => p.trim().toLowerCase()).filter(Boolean);
  const out: Tag[] = [];
  parts.forEach((p) => {
    if (p === "vip") out.push("VIP");
    else if (p.includes("wheel") || p === "ada") out.push("Wheelchair");
    else if (p === "child" || p === "kid") out.push("Child");
    else if (p === "speaker") out.push("Speaker");
    else if (p === "sponsor") out.push("Sponsor");
  });
  return out;
}

export function detectColumnMap(headers: string[]): Record<string, string | undefined> {
  const map: Record<string, string | undefined> = {};
  Object.keys(HEADER_ALIASES).forEach((field) => {
    const aliases = HEADER_ALIASES[field];
    const match = headers.find((h) => aliases.includes(h.toLowerCase().trim()));
    if (match) map[field] = match;
  });
  return map;
}

export function rowsToGuestsWithMap(
  rows: Record<string, unknown>[],
  fieldMap: Record<string, string | undefined>,
): GuestDraft[] {
  return rows
    .map((row) => {
      const firstName = fieldMap.firstName ? String(row[fieldMap.firstName] ?? "").trim() : "";
      const lastName = fieldMap.lastName ? String(row[fieldMap.lastName] ?? "").trim() : "";
      const explicitName = fieldMap.name ? String(row[fieldMap.name] ?? "").trim() : "";
      const combined = [firstName, lastName].filter(Boolean).join(" ");
      const name = combined || explicitName;
      if (!name) return null;
      return {
        firstName: firstName || undefined,
        lastName: lastName || undefined,
        name,
        company: fieldMap.company ? String(row[fieldMap.company] ?? "").trim() || undefined : undefined,
        title: fieldMap.title ? String(row[fieldMap.title] ?? "").trim() || undefined : undefined,
        cohort: fieldMap.cohort ? String(row[fieldMap.cohort] ?? "").trim() || undefined : undefined,
        meal: normalizeMeal(fieldMap.meal ? String(row[fieldMap.meal] ?? "") : undefined),
        tags: normalizeTags(fieldMap.tags ? String(row[fieldMap.tags] ?? "") : undefined),
        dietary: fieldMap.dietary ? String(row[fieldMap.dietary] ?? "").trim() || undefined : undefined,
        notes: fieldMap.notes ? String(row[fieldMap.notes] ?? "").trim() || undefined : undefined,
        rsvpStatus: normalizeRsvp(fieldMap.rsvpStatus ? String(row[fieldMap.rsvpStatus] ?? "") : undefined),
      } as GuestDraft;
    })
    .filter((g): g is GuestDraft => g !== null);
}

export function mapRowsToGuests(rows: Record<string, unknown>[]): GuestDraft[] {
  if (rows.length === 0) return [];
  const headers = Object.keys(rows[0]);
  return rowsToGuestsWithMap(rows, detectColumnMap(headers));
}

export async function parseFileRows(file: File): Promise<{ rows: Record<string, unknown>[]; headers: string[] }> {
  const name = file.name.toLowerCase();
  if (name.endsWith(".csv")) {
    const text = await file.text();
    const parsed = Papa.parse<Record<string, unknown>>(text, { header: true, skipEmptyLines: true });
    const rows = parsed.data;
    return { rows, headers: rows.length ? Object.keys(rows[0]) : [] };
  }
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array" });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
  return { rows, headers: rows.length ? Object.keys(rows[0]) : [] };
}

export async function parseFile(file: File): Promise<GuestDraft[]> {
  const { rows } = await parseFileRows(file);
  return mapRowsToGuests(rows);
}

export interface ReconciliationDiff {
  added: GuestDraft[];
  removed: Guest[];
  changed: { existing: Guest; incoming: GuestDraft; diffs: string[] }[];
  unchanged: number;
}

export function reconcileGuests(existing: Guest[], incoming: GuestDraft[]): ReconciliationDiff {
  const norm = (s: string) => s.toLowerCase().trim();
  const existingByName = new Map(existing.map((g) => [norm(g.name), g]));
  const incomingByName = new Map(incoming.map((g) => [norm(g.name), g]));
  const added: GuestDraft[] = [];
  const removed: Guest[] = [];
  const changed: ReconciliationDiff["changed"] = [];
  let unchanged = 0;

  incoming.forEach((g) => {
    const ex = existingByName.get(norm(g.name));
    if (!ex) added.push(g);
    else {
      const diffs: string[] = [];
      if ((ex.meal ?? "None") !== (g.meal ?? "None")) diffs.push(`meal: ${ex.meal} → ${g.meal}`);
      if ((ex.dietary ?? "") !== (g.dietary ?? "")) diffs.push(`dietary: ${ex.dietary ?? "—"} → ${g.dietary ?? "—"}`);
      if ((ex.rsvpStatus ?? "Confirmed") !== (g.rsvpStatus ?? "Confirmed"))
        diffs.push(`RSVP: ${ex.rsvpStatus} → ${g.rsvpStatus}`);
      if ((ex.cohort ?? "") !== (g.cohort ?? "")) diffs.push(`cohort: ${ex.cohort ?? "—"} → ${g.cohort ?? "—"}`);
      if (diffs.length) changed.push({ existing: ex, incoming: g, diffs });
      else unchanged++;
    }
  });

  existing.forEach((g) => {
    if (!incomingByName.has(norm(g.name))) removed.push(g);
  });

  return { added, removed, changed, unchanged };
}

function fullExportRow(g: Guest, tableLabelById: Record<string, string>) {
  return {
    "Last Name": g.lastName ?? "",
    "First Name": g.firstName ?? "",
    Name: g.name,
    Company: g.company ?? "",
    Title: g.title ?? "",
    Cohort: g.cohort ?? "",
    Tags: g.tags.join(", "),
    Meal: g.meal,
    Dietary: g.dietary ?? "",
    Table: g.tableId ? tableLabelById[g.tableId] ?? "" : "",
    Seat: g.seatIndex ?? "",
    "RSVP Status": g.rsvpStatus,
    Notes: g.notes ?? "",
  };
}

export function exportGuestsCSV(guests: Guest[], tableLabelById: Record<string, string>) {
  const rows = guests.map((g) => fullExportRow(g, tableLabelById));
  download(Papa.unparse(rows), "seating-plan.csv", "text/csv");
}

export function exportGuestsXLSX(guests: Guest[], tableLabelById: Record<string, string>) {
  const rows = guests.map((g) => fullExportRow(g, tableLabelById));
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Seating");
  XLSX.writeFile(wb, "seating-plan.xlsx");
}

export function exportFilteredList(
  guests: Guest[],
  tables: Table[],
  format: "csv" | "xlsx",
  filename: string,
): void {
  const tableLabel = Object.fromEntries(tables.map((t) => [t.id, t.label]));
  const rows = guests.map((g) => fullExportRow(g, tableLabel));
  if (format === "csv") {
    download(Papa.unparse(rows), filename.endsWith(".csv") ? filename : `${filename}.csv`, "text/csv");
  } else {
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "List");
    XLSX.writeFile(wb, filename.endsWith(".xlsx") ? filename : `${filename}.xlsx`);
  }
}

export function download(content: string, filename: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

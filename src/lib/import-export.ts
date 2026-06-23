import * as XLSX from "xlsx";
import Papa from "papaparse";
import type { Guest, Meal, Tag } from "./plan-store";

export type GuestDraft = Omit<Guest, "id">;

const HEADER_ALIASES: Record<keyof GuestDraft, string[]> = {
  name: ["name", "guest", "guest name", "full name", "attendee"],
  company: ["company", "firm", "organization", "org", "employer"],
  title: ["title", "role", "position", "job"],
  group: ["group", "party", "table group", "sponsor"],
  meal: ["meal", "menu", "entree", "food"],
  tags: ["tags", "tag", "labels"],
  dietary: ["dietary", "diet", "allergy", "allergies", "restrictions"],
  notes: ["notes", "note", "comment", "comments"],
  tableId: [],
  seatIndex: [],
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

function normalizeTags(v: string | undefined): Tag[] {
  if (!v) return [];
  const parts = v
    .split(/[,;|]/)
    .map((p) => p.trim().toLowerCase())
    .filter(Boolean);
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

export function mapRowsToGuests(rows: Record<string, unknown>[]): GuestDraft[] {
  if (rows.length === 0) return [];
  const headers = Object.keys(rows[0]);
  const fieldMap: Partial<Record<keyof GuestDraft, string>> = {};
  (Object.keys(HEADER_ALIASES) as (keyof GuestDraft)[]).forEach((field) => {
    const aliases = HEADER_ALIASES[field];
    const match = headers.find((h) =>
      aliases.includes(h.toLowerCase().trim()),
    );
    if (match) fieldMap[field] = match;
  });

  return rows
    .map((row) => {
      const name = String((fieldMap.name && row[fieldMap.name]) ?? "").trim();
      if (!name) return null;
      return {
        name,
        company: fieldMap.company ? String(row[fieldMap.company] ?? "").trim() || undefined : undefined,
        title: fieldMap.title ? String(row[fieldMap.title] ?? "").trim() || undefined : undefined,
        group: fieldMap.group ? String(row[fieldMap.group] ?? "").trim() || undefined : undefined,
        meal: normalizeMeal(fieldMap.meal ? String(row[fieldMap.meal] ?? "") : undefined),
        tags: normalizeTags(fieldMap.tags ? String(row[fieldMap.tags] ?? "") : undefined),
        dietary: fieldMap.dietary ? String(row[fieldMap.dietary] ?? "").trim() || undefined : undefined,
        notes: fieldMap.notes ? String(row[fieldMap.notes] ?? "").trim() || undefined : undefined,
      } as GuestDraft;
    })
    .filter((g): g is GuestDraft => g !== null);
}

export async function parseFile(file: File): Promise<GuestDraft[]> {
  const name = file.name.toLowerCase();
  if (name.endsWith(".csv")) {
    const text = await file.text();
    const parsed = Papa.parse<Record<string, unknown>>(text, {
      header: true,
      skipEmptyLines: true,
    });
    return mapRowsToGuests(parsed.data);
  }
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array" });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
  return mapRowsToGuests(rows);
}

export function exportGuestsCSV(guests: Guest[], tableLabelById: Record<string, string>) {
  const rows = guests.map((g) => ({
    Name: g.name,
    Company: g.company ?? "",
    Title: g.title ?? "",
    Group: g.group ?? "",
    Meal: g.meal,
    Tags: g.tags.join(", "),
    Dietary: g.dietary ?? "",
    Notes: g.notes ?? "",
    Table: g.tableId ? tableLabelById[g.tableId] ?? "" : "",
    Seat: g.seatIndex ?? "",
  }));
  const csv = Papa.unparse(rows);
  download(csv, "seating-plan.csv", "text/csv");
}

export function exportGuestsXLSX(guests: Guest[], tableLabelById: Record<string, string>) {
  const rows = guests.map((g) => ({
    Name: g.name,
    Company: g.company ?? "",
    Title: g.title ?? "",
    Group: g.group ?? "",
    Meal: g.meal,
    Tags: g.tags.join(", "),
    Dietary: g.dietary ?? "",
    Notes: g.notes ?? "",
    Table: g.tableId ? tableLabelById[g.tableId] ?? "" : "",
    Seat: g.seatIndex ?? "",
  }));
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Seating");
  XLSX.writeFile(wb, "seating-plan.xlsx");
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

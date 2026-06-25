import type { Guest, Table, Rule } from "./plan-store";

export type CheckSeverity = "warning" | "info";

export interface CheckWarning {
  id: string;
  category: "duplicate_name" | "similar_company" | "meal_conflict" | "rule_violation";
  severity: CheckSeverity;
  message: string;
  detail?: string;
  guestIds: string[];
}

function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  );
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}

const CORP_SUFFIXES = /\b(ltd\.?|limited|co\.?|corp\.?|corporation|inc\.?|plc|llp|llc|group|holdings|international|intl\.?|hk|hong kong)\b/gi;

function normaliseCompany(name: string): string {
  return name
    .toLowerCase()
    .replace(CORP_SUFFIXES, "")
    .replace(/[^a-z0-9]/g, "")
    .trim();
}

const VEGAN_KEYWORDS = ["vegan", "plant-based", "plant based", "no animal", "no dairy", "no egg"];
const VEG_KEYWORDS = ["vegetarian", "veggie", "no meat", "no beef", "no chicken", "no pork", "no fish", "no seafood"];
const HALAL_KEYWORDS = ["halal"];
const KOSHER_KEYWORDS = ["kosher"];

function matchesKeywords(dietary: string, keywords: string[]): boolean {
  const d = dietary.toLowerCase();
  return keywords.some(k => d.includes(k));
}

let _warnId = 0;
function wid() { return `w${++_warnId}`; }

export function runSmartChecks(
  guests: Guest[],
  tables: Table[],
  rules: Rule[],
): CheckWarning[] {
  _warnId = 0;
  const warnings: CheckWarning[] = [];
  const eligible = guests.filter(
    g => !g.isPlaceholder && g.rsvpStatus !== "Declined" && g.rsvpStatus !== "No-show" && g.rsvpStatus !== "Withdrawn"
  );

  // Check 1: Duplicate names
  const nameBuckets = new Map<string, Guest[]>();
  eligible.forEach(g => {
    const key = g.name.trim().toLowerCase();
    if (!key) return;
    if (!nameBuckets.has(key)) nameBuckets.set(key, []);
    nameBuckets.get(key)!.push(g);
  });
  nameBuckets.forEach((group) => {
    if (group.length < 2) return;
    warnings.push({
      id: wid(),
      category: "duplicate_name",
      severity: "warning",
      message: `"${group[0].name}" appears ${group.length} times`,
      detail: `${group.length} guests share this name. Verify they are different people or remove the duplicate.`,
      guestIds: group.map(g => g.id),
    });
  });

  // Check 2: Similar company names
  const companies = [...new Set(
    eligible.map(g => g.company?.trim()).filter(Boolean) as string[]
  )];
  const flaggedPairs = new Set<string>();
  for (let i = 0; i < companies.length; i++) {
    for (let j = i + 1; j < companies.length; j++) {
      const a = companies[i], b = companies[j];
      const normA = normaliseCompany(a);
      const normB = normaliseCompany(b);
      if (!normA || !normB) continue;
      const identical = normA === normB;
      const dist = identical ? 0 : levenshtein(normA, normB);
      const threshold = Math.max(2, Math.floor(Math.min(normA.length, normB.length) * 0.15));
      if (identical || dist <= threshold) {
        const pairKey = [a, b].sort().join("|");
        if (flaggedPairs.has(pairKey)) continue;
        flaggedPairs.add(pairKey);
        const affectedGuests = eligible.filter(
          g => g.company === a || g.company === b
        );
        warnings.push({
          id: wid(),
          category: "similar_company",
          severity: "warning",
          message: `"${a}" and "${b}" may be the same company`,
          detail: `These appear to be the same organisation entered differently. Consider standardising the company name.`,
          guestIds: affectedGuests.map(g => g.id),
        });
      }
    }
  }

  // Check 3: Meal vs dietary contradictions
  eligible.forEach(g => {
    if (!g.dietary) return;
    const d = g.dietary;
    const meal = g.meal;

    if (matchesKeywords(d, VEGAN_KEYWORDS)) {
      if (meal && meal !== "Vegan" && meal !== "None") {
        warnings.push({
          id: wid(),
          category: "meal_conflict",
          severity: "warning",
          message: `${g.name}: meal "${meal}" may conflict with vegan dietary note`,
          detail: `Dietary: "${d}". If this guest is vegan, consider changing their meal to Vegan.`,
          guestIds: [g.id],
        });
      }
    } else if (matchesKeywords(d, VEG_KEYWORDS)) {
      if (meal === "Chicken" || meal === "Fish") {
        warnings.push({
          id: wid(),
          category: "meal_conflict",
          severity: "warning",
          message: `${g.name}: meal "${meal}" may conflict with vegetarian dietary note`,
          detail: `Dietary: "${d}". If this guest is vegetarian, consider changing their meal to Vegetarian or Vegan.`,
          guestIds: [g.id],
        });
      }
    }

    if (matchesKeywords(d, HALAL_KEYWORDS) && (meal === "Chicken" || meal === "Fish")) {
      warnings.push({
        id: wid(),
        category: "meal_conflict",
        severity: "info",
        message: `${g.name}: halal requirement noted — confirm meal is halal-certified`,
        detail: `Dietary: "${d}". Ensure the kitchen is briefed that this guest requires halal food.`,
        guestIds: [g.id],
      });
    }

    if (matchesKeywords(d, KOSHER_KEYWORDS) && (meal === "Chicken" || meal === "Fish")) {
      warnings.push({
        id: wid(),
        category: "meal_conflict",
        severity: "info",
        message: `${g.name}: kosher requirement noted — confirm meal is kosher-certified`,
        detail: `Dietary: "${d}". Ensure the kitchen is briefed that this guest requires kosher food.`,
        guestIds: [g.id],
      });
    }
  });

  // Check 4: Hard rule violations
  const enabledRules = rules.filter(r => r.enabled);

  enabledRules.forEach(rule => {
    if (rule.type === "keep_together" && rule.guestIds && rule.guestIds.length >= 2) {
      const seated = rule.guestIds.filter(id => {
        const g = guests.find(x => x.id === id);
        return g?.tableId;
      });
      if (seated.length < 2) return;
      const tableIds = new Set(
        rule.guestIds.map(id => guests.find(x => x.id === id)?.tableId).filter(Boolean)
      );
      if (tableIds.size > 1) {
        const names = rule.guestIds.map(id => guests.find(x => x.id === id)?.name ?? id).join(", ");
        warnings.push({
          id: wid(),
          category: "rule_violation",
          severity: "warning",
          message: `"Keep together" rule broken: guests are at different tables`,
          detail: `Affected: ${names}`,
          guestIds: rule.guestIds,
        });
      }
    }

    if (rule.type === "keep_apart" && rule.guestIds && rule.guestIds.length >= 2) {
      const byTable = new Map<string, string[]>();
      rule.guestIds.forEach(id => {
        const g = guests.find(x => x.id === id);
        if (g?.tableId) {
          if (!byTable.has(g.tableId)) byTable.set(g.tableId, []);
          byTable.get(g.tableId)!.push(id);
        }
      });
      byTable.forEach((ids, tableId) => {
        if (ids.length >= 2) {
          const tbl = tables.find(t => t.id === tableId);
          const names = ids.map(id => guests.find(x => x.id === id)?.name ?? id).join(" & ");
          warnings.push({
            id: wid(),
            category: "rule_violation",
            severity: "warning",
            message: `"Keep apart" rule broken: ${names} are at the same table (${tbl?.label ?? "?"})`,
            detail: `These guests should not share a table.`,
            guestIds: ids,
          });
        }
      });
    }

    if (rule.type === "seat_adjacent" && rule.guestIds && rule.guestIds.length === 2) {
      const [idA, idB] = rule.guestIds;
      const gA = guests.find(x => x.id === idA);
      const gB = guests.find(x => x.id === idB);
      if (!gA?.tableId || !gB?.tableId || !gA.seatIndex || !gB.seatIndex) return;
      if (gA.tableId !== gB.tableId) {
        warnings.push({
          id: wid(),
          category: "rule_violation",
          severity: "warning",
          message: `"Seat adjacent" rule broken: ${gA.name} and ${gB.name} are at different tables`,
          detail: `They need to be at adjacent seats at the same table.`,
          guestIds: [idA, idB],
        });
        return;
      }
      const tbl = tables.find(t => t.id === gA.tableId);
      if (!tbl) return;
      const n = tbl.seats;
      const isAdj = (a: number, b: number) =>
        Math.abs(a - b) === 1 || (Math.min(a, b) === 1 && Math.max(a, b) === n);
      if (!isAdj(gA.seatIndex, gB.seatIndex)) {
        warnings.push({
          id: wid(),
          category: "rule_violation",
          severity: "warning",
          message: `"Seat adjacent" rule broken: ${gA.name} (seat ${gA.seatIndex}) and ${gB.name} (seat ${gB.seatIndex}) are not adjacent`,
          detail: `Table ${tbl.label} has ${n} seats. Adjacent means consecutive seat numbers or seat 1 & seat ${n}.`,
          guestIds: [idA, idB],
        });
      }
    }

    if (rule.type === "keep_cohort_together" && rule.cohort) {
      const cohortGuests = guests.filter(
        g => g.cohort === rule.cohort && g.tableId && !g.isPlaceholder
      );
      if (cohortGuests.length < 2) return;
      const tableIds = new Set(cohortGuests.map(g => g.tableId));
      if (tableIds.size > 1) {
        warnings.push({
          id: wid(),
          category: "rule_violation",
          severity: "warning",
          message: `Cohort "${rule.cohort}" is split across ${tableIds.size} tables`,
          detail: `${cohortGuests.length} cohort members are not all at the same table.`,
          guestIds: cohortGuests.map(g => g.id),
        });
      }
    }
  });

  return warnings;
}

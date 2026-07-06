import type { Guest, Rule, Table } from "./plan-store";

export interface TableSuggestion {
  tableId: string;
  tableLabel: string;
  score: number;
  openSeats: number;
  reasons: string[];
}

interface Args {
  candidate: {
    company?: string;
    cohort?: string;
    tags: string[];
  };
  tables: Table[];
  guests: Guest[];
  rules: Rule[];
  vipTableIds?: Set<string>;
  frontRowTableIds?: Set<string>;
}

/**
 * Rank tables for a walk-in guest. Returns tables sorted best-first.
 * Only excludes tables that would trigger a hard `keep_apart` rule.
 * A completely empty table is still eligible but gets a small penalty
 * so gaps are filled before opening new tables.
 */
export function rankTablesForWalkIn(args: Args): TableSuggestion[] {
  const { candidate, tables, guests, rules, vipTableIds, frontRowTableIds } = args;
  const activeRules = rules.filter((r) => r.enabled);
  const apartSets = activeRules
    .filter((r) => r.type === "keep_apart" && r.guestIds && r.guestIds.length > 1)
    .map((r) => new Set(r.guestIds!));

  const isVip = candidate.tags.includes("VIP");
  const suggestions: TableSuggestion[] = [];

  for (const t of tables) {
    const occupants = guests.filter(
      (g) => g.tableId === t.id && g.rsvpStatus !== "Declined" && g.rsvpStatus !== "No-show" && g.rsvpStatus !== "Withdrawn",
    );
    const openSeats = t.seats - occupants.length;
    if (openSeats <= 0) continue;

    // Hard rule: skip if a keep_apart rule would be triggered by any existing
    // guest at this table. We don't know the walk-in's id yet, so match on
    // company/cohort — the ruleset is guest-id based so this is a soft check.
    // (True keep_apart hits happen after assignment; the ranking just avoids
    // obvious conflicts.)
    let violates = false;
    for (const set of apartSets) {
      for (const other of occupants) {
        if (set.has(other.id) && candidate.company && other.company === candidate.company) {
          // company match plus a keep-apart set involving this guest — soft skip
          violates = true;
          break;
        }
      }
      if (violates) break;
    }
    if (violates) continue;

    const reasons: string[] = [];
    let score = 0;

    // (1) has open seat — baseline
    score += 10;

    // (2) prefer partially-full over empty (fill gaps first)
    if (occupants.length > 0 && openSeats < t.seats) {
      score += 8;
    } else if (occupants.length === 0) {
      score -= 4;
      reasons.push("empty table");
    }

    // (3) same-company / cohort soft match
    if (candidate.company) {
      const sameCompany = occupants.filter((g) => g.company && g.company === candidate.company);
      if (sameCompany.length > 0) {
        score += 20 + Math.min(sameCompany.length, 3) * 3;
        const first = sameCompany[0];
        reasons.push(
          sameCompany.length === 1
            ? `same company as ${first.name.split(" ").slice(-1)[0] || first.name}`
            : `${sameCompany.length} from ${candidate.company}`,
        );
      }
    }
    if (candidate.cohort) {
      const sameCohort = occupants.filter((g) => g.cohort === candidate.cohort);
      if (sameCohort.length > 0) {
        score += 15;
        reasons.push(`same cohort (${candidate.cohort})`);
      }
    }

    // (4) VIP → prefer VIP/front-row tables
    if (isVip) {
      if (vipTableIds?.has(t.id)) {
        score += 30;
        reasons.push("VIP table");
      } else if (frontRowTableIds?.has(t.id)) {
        score += 15;
        reasons.push("front row");
      }
    }

    // Baseline reason
    reasons.unshift(`${openSeats} seat${openSeats !== 1 ? "s" : ""} open`);

    suggestions.push({
      tableId: t.id,
      tableLabel: t.label,
      score,
      openSeats,
      reasons,
    });
  }

  suggestions.sort((a, b) => b.score - a.score);
  return suggestions;
}

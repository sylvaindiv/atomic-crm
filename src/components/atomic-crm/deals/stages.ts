import type { ConfigurationContextValue } from "../root/ConfigurationContext";
import type { Deal } from "../types";
import { dealNeedsAction } from "./dealUtils";

export type DealsByStage = Record<Deal["stage"], Deal[]>;

/**
 * Note statuses that are rendered as deals Kanban columns, in configuration
 * order.
 *
 * A note status persisted before the `visibleInDealsKanban` flag existed has
 * no such property on it: treat a missing flag as visible, so a
 * pre-existing configuration never opens on an empty board.
 */
export const getVisibleDealStatuses = (
  noteStatuses: ConfigurationContextValue["noteStatuses"],
) => noteStatuses.filter((status) => status.visibleInDealsKanban !== false);

/**
 * Groups deals by their `stage` into the visible Kanban columns (one per
 * visible note status, in configuration order), each column sorted by
 * `index`.
 *
 * A deal whose `stage` matches no visible column is omitted from the
 * result -- it never falls back to the first column, and its stored
 * `stage` is never rewritten. It simply stops appearing on the board until
 * a real status is assigned through the deal edit form.
 */
export const getDealsByStage = (
  unorderedDeals: Deal[],
  noteStatuses: ConfigurationContextValue["noteStatuses"],
): DealsByStage => {
  if (!noteStatuses) return {};
  const visibleStatuses = getVisibleDealStatuses(noteStatuses);
  const dealsByStage: DealsByStage = visibleStatuses.reduce(
    (obj, status) => ({ ...obj, [status.value]: [] }),
    {} as DealsByStage,
  );
  unorderedDeals.forEach((deal) => {
    if (dealsByStage[deal.stage]) {
      dealsByStage[deal.stage].push(deal);
    }
  });
  // Deals that need action (next action due today or overdue) float to the
  // top of their column; within each group (needs-action / not), order is
  // preserved by index. Array.prototype.sort is stable, so a comparator
  // that only decides the needs-action group falls back to index untouched.
  visibleStatuses.forEach((status) => {
    dealsByStage[status.value] = dealsByStage[status.value].sort(
      (recordA: Deal, recordB: Deal) =>
        Number(dealNeedsAction(recordB.next_action_due_date)) -
          Number(dealNeedsAction(recordA.next_action_due_date)) ||
        recordA.index - recordB.index,
    );
  });
  return dealsByStage;
};

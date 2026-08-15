import type { LabeledValue } from "../types";

// Kept here so the still-existing deal screens (DealShow, DealColumn,
// CompanyShow) don't need an import-path churn; the actual implementation
// moved to a deal-free home shared with the contact page (TASK-003) and the
// Kanban card / dashboard.
export { formatDealAmount } from "../misc/formatAmount";
// Same rationale -- the "needs action" rule and the relative-date formatter
// moved to a deal-free home shared with the contacts Kanban (TASK-004).
export {
  needsAction as dealNeedsAction,
  getRelativeTimeString,
} from "../misc/nextAction";

export const findDealLabel = (statuses: LabeledValue[], dealValue: string) => {
  const status = statuses.find((status) => status.value === dealValue);
  return status?.label;
};

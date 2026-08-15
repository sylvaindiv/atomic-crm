import { isDueToday, isOverdue } from "../tasks/tasksPredicate";
import type { LabeledValue } from "../types";

/**
 * Whether a deal's next action is due today or overdue -- the shared
 * "needs action" rule. Mirrors `NeedsActionInput`'s server-side filter
 * (`next_action_due_date@lte` = end of today) and backs both the Kanban
 * column sort (`stages.ts`) and the countdown chip (`DealCard.tsx`), so the
 * three layers can't drift apart.
 */
export function dealNeedsAction(dueDate?: string | null): boolean {
  if (!dueDate) return false;
  return isOverdue(dueDate) || isDueToday(dueDate);
}

// Kept here so the still-existing deal screens (DealShow, DealColumn,
// CompanyShow) don't need an import-path churn; the actual implementation
// moved to a deal-free home shared with the contact page (TASK-003) and the
// Kanban card / dashboard.
export { formatDealAmount } from "../misc/formatAmount";

export const findDealLabel = (statuses: LabeledValue[], dealValue: string) => {
  const status = statuses.find((status) => status.value === dealValue);
  return status?.label;
};

export function getRelativeTimeString(
  dateString: string,
  locale = "en",
): string {
  const date = new Date(dateString);
  date.setHours(0, 0, 0, 0);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const diff = date.getTime() - today.getTime();
  const unitDiff = Math.round(diff / (1000 * 60 * 60 * 24));

  // Check if the date is more than one week old
  if (Math.abs(unitDiff) > 7) {
    return new Intl.DateTimeFormat(locale, {
      day: "numeric",
      month: "long",
    }).format(date);
  }

  // Intl.RelativeTimeFormat for dates within the last week
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
  return ucFirst(rtf.format(unitDiff, "day"));
}

function ucFirst(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

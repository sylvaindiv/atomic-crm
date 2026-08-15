import { isDueToday, isOverdue } from "../tasks/tasksPredicate";

/**
 * Whether a next-action due date is due today or overdue -- the shared
 * "needs action" rule. Deal-free (fed only by a raw due date, not a Deal or
 * Contact record) so it can back the contacts Kanban column sort and
 * countdown chip (`contacts/kanban/`, TASK-004) as well as the pre-existing
 * deals Kanban (re-exported as `dealNeedsAction` by `deals/dealUtils.ts`)
 * without the two drifting apart.
 */
export function needsAction(dueDate?: string | null): boolean {
  if (!dueDate) return false;
  return isOverdue(dueDate) || isDueToday(dueDate);
}

/**
 * Formats a date as a short relative string ("Yesterday", "In 3 days"...)
 * within a week of today, falling back to a localized day/month format
 * beyond that.
 */
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

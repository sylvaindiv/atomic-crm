import { differenceInDays } from "date-fns";
import { useTranslate } from "ra-core";
import { Badge } from "@/components/ui/badge";

import { isDueTomorrow, isOverdue } from "../tasks/tasksPredicate";
import { needsAction } from "./nextAction";

const amberChipClassName =
  "border-amber-500 text-amber-700 dark:border-amber-400 dark:text-amber-400";
const greenChipClassName =
  "border-green-500 text-green-700 dark:border-green-400 dark:text-green-400";

/**
 * Countdown chip for a next-action due date, colored by urgency bucket
 * (see `tasks/tasksPredicate.ts` for the shared overdue/today/tomorrow
 * rules). Deal-free -- fed only by a raw due date string, so it backs the
 * contacts Kanban card (TASK-004) without pulling in the deals module.
 */
export const NextActionChip = ({ dueDate }: { dueDate?: string | null }) => {
  const translate = useTranslate();
  if (!dueDate) return null;

  if (needsAction(dueDate)) {
    if (isOverdue(dueDate)) {
      return (
        <Badge variant="destructive">
          {translate("crm.kanban.next_action_due.overdue")}
        </Badge>
      );
    }
    return (
      <Badge variant="outline" className={greenChipClassName}>
        {translate("crm.kanban.next_action_due.today")}
      </Badge>
    );
  }
  if (isDueTomorrow(dueDate)) {
    return (
      <Badge variant="outline" className={amberChipClassName}>
        {translate("crm.kanban.next_action_due.tomorrow")}
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="text-muted-foreground">
      {translate("crm.kanban.next_action_due.in_days", {
        smart_count: differenceInDays(new Date(dueDate), new Date()),
      })}
    </Badge>
  );
};

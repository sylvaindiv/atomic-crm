import { endOfToday } from "date-fns";
import { useListFilterContext, useTranslate } from "ra-core";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

const FILTER_KEY = "next_action_due_date@lte";

/**
 * Top-bar toggle for the "needs action" contacts filter (next action due
 * today or overdue) -- mirrors the Kanban column sort / countdown chip's
 * rule (see misc/nextAction.ts) and the equivalent ToggleFilterButton in
 * ContactListFilter's side panel, using the same filter key.
 */
export const NeedsActionInput = () => {
  const translate = useTranslate();
  const { filterValues, displayedFilters, setFilters } = useListFilterContext();

  const handleChange = () => {
    const newFilterValues = { ...filterValues };
    if (typeof filterValues[FILTER_KEY] !== "undefined") {
      delete newFilterValues[FILTER_KEY];
    } else {
      newFilterValues[FILTER_KEY] = endOfToday().toISOString();
    }
    setFilters(newFilterValues, displayedFilters);
  };

  return (
    <div className="flex items-center space-x-2">
      <Label htmlFor="needs-action">
        {translate("resources.contacts.filters.needs_action")}
      </Label>
      <Switch
        id="needs-action"
        checked={typeof filterValues[FILTER_KEY] !== "undefined"}
        onCheckedChange={handleChange}
      />
    </div>
  );
};

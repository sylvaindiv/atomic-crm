import { endOfToday } from "date-fns/endOfToday";
import { useListFilterContext, useTranslate } from "ra-core";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

const FILTER_KEY = "next_action_due_date@lte";

/**
 * Toggle filtering deals whose next action is due today or overdue.
 *
 * Mirrors the `OnlyMineInput` toggle pattern: reads/writes filters via
 * `useListFilterContext()` instead of behaving like a regular form input.
 */
export const NeedsActionInput = (_: { alwaysOn: boolean; source: string }) => {
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
    <div className="mt-auto pb-2.25">
      <div className="flex items-center space-x-2">
        <Label htmlFor="needs-action">
          {translate("resources.deals.filters.needs_action", {
            _: "To handle",
          })}
        </Label>
        <Switch
          id="needs-action"
          checked={typeof filterValues[FILTER_KEY] !== "undefined"}
          onCheckedChange={handleChange}
        />
      </div>
    </div>
  );
};

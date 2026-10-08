import { useId } from "react";
import { useGetIdentity, useListFilterContext, useTranslate } from "ra-core";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

export const AssignedToMeInput = () => {
  const id = useId();
  const translate = useTranslate();
  const { identity, isPending } = useGetIdentity();
  const { filterValues, displayedFilters, setFilters } = useListFilterContext();
  const identityId = identity?.id;

  const handleChange = (checked: boolean) => {
    if (identityId == null) return;

    const nextFilters = { ...filterValues };
    if (checked) nextFilters.sales_id = identityId;
    else delete nextFilters.sales_id;
    setFilters(nextFilters, displayedFilters);
  };

  return (
    <div className="flex items-center gap-2 self-center whitespace-nowrap">
      <Label htmlFor={id}>{translate("crm.common.assigned_to_me")}</Label>
      <Switch
        id={id}
        checked={identityId != null && filterValues.sales_id === identityId}
        disabled={isPending || identityId == null}
        onCheckedChange={handleChange}
      />
    </div>
  );
};

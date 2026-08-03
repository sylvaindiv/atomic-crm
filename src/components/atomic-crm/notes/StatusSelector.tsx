import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ChevronDownIcon } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";

import { useConfigurationContext } from "../root/ConfigurationContext";
import { Translate, useTranslate } from "ra-core";

const NONE_VALUE = "__none__";

type StatusSelectorProps = {
  disabled?: boolean;
  status?: string;
  setStatus: (status: string) => void;
  triggerClassName?: string;
};

export const StatusSelector = ({
  disabled,
  status,
  setStatus,
  triggerClassName,
}: StatusSelectorProps) => {
  const { noteStatuses } = useConfigurationContext();
  const translate = useTranslate();
  const isMobile = useIsMobile();
  const noneLabel = translate("resources.contacts.background.status_none", {
    _: "None",
  });
  const selectedOption = noteStatuses.find((s) => s.value === status);

  if (isMobile) {
    // use native select on mobile for better performance and accessibility
    return (
      <div className={cn("relative", "w-32", triggerClassName)}>
        <div
          aria-hidden="true"
          className={cn(
            "flex w-full items-center justify-between gap-2 rounded-md border bg-transparent px-3 py-2 text-sm whitespace-nowrap shadow-xs h-9",
            selectedOption ? "border" : "border-input",
            disabled && "cursor-not-allowed opacity-50",
            selectedOption && "rounded-full font-medium px-2 py-0.5 text-xs",
          )}
          style={
            selectedOption
              ? {
                  backgroundColor: `color-mix(in srgb, ${selectedOption.color} 16%, transparent)`,
                  borderColor: selectedOption.color,
                  color: selectedOption.color,
                }
              : undefined
          }
        >
          <span className="flex items-center gap-2 line-clamp-1">
            {selectedOption ? selectedOption.label : noneLabel}
          </span>
          <ChevronDownIcon className="size-4 opacity-50 shrink-0" />
        </div>
        <select
          disabled={disabled}
          value={status || ""}
          onChange={(e) => setStatus(e.target.value)}
          aria-label={translate("resources.notes.fields.status", {
            _: "Status",
          })}
          className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
        >
          <option value="">{noneLabel}</option>
          {noteStatuses.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>
    );
  }

  /**
   * Radix's Select component doesn't allow empty string as value, so we use a placeholder value and convert it back to empty string on change
   * @see https://github.com/radix-ui/primitives/issues/2706
   */
  const handleValueChange = (value: string) => {
    setStatus(value === NONE_VALUE ? "" : value);
  };

  return (
    <Select
      disabled={disabled}
      value={status || NONE_VALUE}
      onValueChange={handleValueChange}
    >
      <SelectTrigger
        size="sm"
        className={cn(
          "w-32",
          selectedOption
            ? "border rounded-full font-medium px-2 py-0.5 text-xs focus-visible:ring-0"
            : "border-input",
          triggerClassName,
        )}
        style={
          selectedOption
            ? {
                backgroundColor: `color-mix(in srgb, ${selectedOption.color} 16%, transparent)`,
                borderColor: selectedOption.color,
                color: selectedOption.color,
              }
            : undefined
        }
      >
        <SelectValue placeholder={noneLabel} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={NONE_VALUE}>
          <Translate i18nKey="resources.contacts.background.status_none">
            None
          </Translate>
        </SelectItem>
        {noteStatuses.map((statusOption) => (
          <SelectItem
            key={statusOption.value}
            value={statusOption.value}
            className="rounded-full border font-medium focus:!bg-transparent focus:!text-current"
            style={{
              backgroundColor: `color-mix(in srgb, ${statusOption.color} 16%, transparent)`,
              borderColor: statusOption.color,
              color: statusOption.color,
            }}
          >
            {statusOption.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};

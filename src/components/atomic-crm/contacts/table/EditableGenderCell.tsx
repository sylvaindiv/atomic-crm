import { useRecordContext, useTranslate } from "ra-core";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import type { Contact } from "../../types";
import { contactGender, translateContactGenderLabel } from "../contactModel";
import { useUpdateContactField } from "./useUpdateContactField";

/**
 * Always-live gender select for a contacts table cell.
 *
 * Shares its choices with `ContactIdentityInputs`'s `RadioButtonGroupInput`
 * (`contactGender`, see `contactModel.ts`) but as a compact dropdown suited
 * to a dense table cell. Selecting a choice commits immediately through
 * `useUpdateContactField`, matching `EditableBooleanCell`'s always-live
 * toggle (no separate edit-mode step) — hand-rolled with the shadcn
 * `Select` rather than `admin/select-input.tsx` / `useInput()`, since a
 * `DataTable.Col` cell has no surrounding react-hook-form `<Form>` for
 * those to bind to.
 */
export const EditableGenderCell = () => {
  const record = useRecordContext<Contact>();
  const updateField = useUpdateContactField("gender");
  const translate = useTranslate();

  if (!record) return null;

  return (
    <div onClick={(event) => event.stopPropagation()}>
      <Select value={record.gender} onValueChange={updateField}>
        <SelectTrigger size="sm" className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {contactGender.map((choice) => (
            <SelectItem key={choice.value} value={choice.value}>
              {translateContactGenderLabel(choice, translate)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
};

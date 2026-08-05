import { useRecordContext } from "ra-core";
import { Switch } from "@/components/ui/switch";

import type { Contact } from "../../types";
import { useUpdateContactField } from "./useUpdateContactField";

/** Contact columns holding a plain boolean flag, safe for an always-live switch cell. */
type EditableBooleanField = "has_newsletter";

interface EditableBooleanCellProps {
  /** Contact column this cell reads and commits to. */
  source: EditableBooleanField;
  /** Accessible name for the switch — a dense table cell has no visible label of its own. */
  label: string;
}

/**
 * Always-live boolean toggle for a single contact column.
 *
 * Unlike `EditableTextCell`, there is no edit-mode step: every click flips
 * the switch and commits immediately through `useUpdateContactField`.
 */
export const EditableBooleanCell = ({
  source,
  label,
}: EditableBooleanCellProps) => {
  const record = useRecordContext<Contact>();
  const updateField = useUpdateContactField(source);

  if (!record) return null;

  return (
    <div onClick={(event) => event.stopPropagation()}>
      <Switch
        checked={Boolean(record[source])}
        onCheckedChange={updateField}
        aria-label={label}
      />
    </div>
  );
};

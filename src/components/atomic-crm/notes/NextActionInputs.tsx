import { useEffect, useRef } from "react";
import { required, useTranslate, type Identifier } from "ra-core";
import { useFormContext, useWatch } from "react-hook-form";
import { AutocompleteInput, ReferenceInput } from "@/components/admin";
import { DateTimeInput } from "@/components/admin/date-time-input";
import { SelectInput } from "@/components/admin/select-input";
import { TextInput } from "@/components/admin/text-input";

const actionModes = [
  { id: "create", name: "resources.notes.next_action.create" },
  { id: "existing", name: "resources.notes.next_action.existing" },
];

export const NextActionInputs = ({
  defaultContactId,
}: {
  defaultContactId?: Identifier;
}) => {
  const translate = useTranslate();
  const { control, setValue } = useFormContext();
  const mode = useWatch({ control, name: "next_action.mode" }) ?? "create";
  const contactId =
    useWatch({ control, name: "contact_id" }) ?? defaultContactId;
  const previousContactId = useRef(contactId);

  useEffect(() => {
    if (previousContactId.current !== contactId) {
      setValue("next_action.task_id", undefined, { shouldDirty: true });
      previousContactId.current = contactId;
    }
  }, [contactId, setValue]);

  return (
    <div className="space-y-2 rounded-md border p-3">
      <p className="text-sm font-medium">
        {translate("resources.notes.next_action.title")}
      </p>
      <SelectInput
        source="next_action.mode"
        label={false}
        choices={actionModes}
        optionText="name"
        optionValue="id"
        defaultValue="create"
        validate={required()}
        helperText={false}
      />
      {mode === "create" ? (
        <>
          <TextInput
            source="next_action.text"
            label="resources.tasks.fields.text"
            validate={required()}
            helperText={false}
          />
          <DateTimeInput
            source="next_action.due_date"
            label="resources.tasks.fields.due_date"
            validate={required()}
            helperText={false}
          />
        </>
      ) : (
        <ReferenceInput
          source="next_action.task_id"
          reference="tasks"
          filter={{ contact_id: contactId, done_date: null }}
          sort={{ field: "due_date", order: "ASC" }}
          perPage={25}
          enableGetChoices={() => contactId != null}
        >
          <AutocompleteInput
            label="resources.notes.next_action.existing"
            optionText={(task: { text?: string; due_date?: string }) =>
              `${task.text ?? ""} — ${task.due_date ?? ""}`
            }
            validate={required()}
            helperText={false}
            modal
          />
        </ReferenceInput>
      )}
    </div>
  );
};

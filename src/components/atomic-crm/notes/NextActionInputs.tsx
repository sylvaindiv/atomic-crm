import { required } from "ra-core";
import { DateInput } from "@/components/admin/date-input";

export const NextActionInputs = () => (
  <DateInput
    source="next_action.due_date"
    label="resources.tasks.fields.due_date"
    validate={required()}
    helperText={false}
    onClick={(event) => {
      try {
        event.currentTarget.showPicker?.();
      } catch {
        // Embedded browsers may restrict showPicker; native input remains usable.
      }
    }}
  />
);

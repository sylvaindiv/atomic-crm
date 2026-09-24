import { email, required, useGetIdentity, useRecordContext } from "ra-core";
import { BooleanInput } from "@/components/admin/boolean-input";
import { TextInput } from "@/components/admin/text-input";

import type { Sale } from "../types";

export function SalesInputs({ create = false }: { create?: boolean }) {
  const { identity } = useGetIdentity();
  const record = useRecordContext<Sale>();
  return (
    <div className="space-y-4 w-full">
      <TextInput source="first_name" validate={required()} helperText={false} />
      <TextInput source="last_name" validate={required()} helperText={false} />
      <TextInput
        source="email"
        validate={[required(), email()]}
        helperText={false}
      />
      {create ? (
        <TextInput
          source="password"
          type="password"
          validate={required()}
          helperText={false}
        />
      ) : (
        <BooleanInput
          source="disabled"
          readOnly={record?.id === identity?.id}
          helperText={false}
        />
      )}
    </div>
  );
}

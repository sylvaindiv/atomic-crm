import { useCallback } from "react";
import { useNotify, useRecordContext, useUpdate } from "ra-core";

import type { Contact } from "../../types";

/**
 * Commits a single-column optimistic update to the current contact record.
 *
 * Extracts the `useUpdate("contacts", ..., { mutationMode: "optimistic" })`
 * boilerplate proven by `ContactStatusSelector` (see `ContactInputs.tsx`) so
 * every inline-editable table cell shares the same instant-UI-update /
 * rollback-and-notify-on-error behavior. Must be called from a component
 * rendered inside a contact `RecordContext` (e.g. a `DataTable.Col` cell).
 *
 * @param field - the contact column this cell commits to
 * @returns a setter that writes `value` to `field`; no-ops when `value`
 *   already equals the record's current value, so an unchanged edit issues
 *   no request
 */
export const useUpdateContactField = <K extends keyof Contact>(field: K) => {
  const record = useRecordContext<Contact>();
  const [update] = useUpdate<Contact>();
  const notify = useNotify();

  return useCallback(
    (value: Contact[K]) => {
      if (!record || value === record[field]) return;

      update(
        "contacts",
        {
          id: record.id,
          // `field` is exactly `K` here, so this literal has exactly one key of type K.
          data: { [field]: value } as Record<K, Contact[K]>,
          previousData: record,
        },
        {
          mutationMode: "optimistic",
          onError: (error) => {
            notify(
              typeof error === "string"
                ? error
                : error?.message || "ra.notification.http_error",
              {
                type: "error",
                messageArgs: {
                  _: typeof error === "string" ? error : error?.message,
                },
              },
            );
          },
        },
      );
    },
    [record, update, notify, field],
  );
};

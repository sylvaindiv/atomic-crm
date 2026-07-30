import { ContactStatusSelector } from "../ContactInputs";

/**
 * Table-cell wrapper around the existing `ContactStatusSelector`.
 *
 * Reuses it verbatim — only isolates clicks so choosing a status doesn't
 * bubble up and trigger the row's navigate handler.
 */
export const EditableStatusCell = () => (
  <div onClick={(event) => event.stopPropagation()}>
    <ContactStatusSelector />
  </div>
);

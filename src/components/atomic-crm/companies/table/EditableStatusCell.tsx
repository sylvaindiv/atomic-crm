import { CompanyStatusSelector } from "../CompanyInputs";

/**
 * Table-cell wrapper around the existing `CompanyStatusSelector`.
 *
 * Reuses it verbatim — only isolates clicks so choosing a status doesn't
 * bubble up and trigger the row's navigate handler.
 */
export const EditableStatusCell = () => (
  <div onClick={(event) => event.stopPropagation()}>
    <CompanyStatusSelector />
  </div>
);

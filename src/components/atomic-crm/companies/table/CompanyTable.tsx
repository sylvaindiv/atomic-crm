import { useRecordContext, useTranslate } from "ra-core";
import { DataTable } from "@/components/admin/data-table";
import { ReferenceField } from "@/components/admin/reference-field";

import { useConfigurationContext } from "../../root/ConfigurationContext";
import type { Company } from "../../types";
import { CompanyAvatar } from "../CompanyAvatar";
import { getTranslatedCompanySizeLabel } from "../getTranslatedCompanySizeLabel";
import { sizes } from "../sizes";

/**
 * Read-only table for the Clubs list, modeled on
 * `contacts/table/ContactTable.tsx` for visual/structural consistency (same
 * `<Card>` wrapper -- applied by the caller, `CompanyList.tsx` -- spacing and
 * column density: see the wrapping `<div>` below, copied from
 * `ContactTable`).
 *
 * Deliberately narrower than `ContactTable`: every cell here is read-only
 * (no inline editing, this resource has no editable-cell family), there is
 * no columns picker (the column set is short and fixed), and no
 * bulk-actions toolbar (`bulkActionButtons={false}` also drops the
 * selection checkbox column entirely, unlike `ContactTable`'s
 * `bulkActionsToolbar={false}` which keeps checkboxes for a toolbar
 * rendered by its caller). `rowClick="show"` navigates the whole row to the
 * Club's Show page, so -- also unlike `ContactTable`, which disables row
 * click because its cells mutate on click -- no column needs its own
 * `Link`/click-propagation guard.
 */
export const CompanyTable = () => {
  return (
    <div className="text-xs [&_td]:px-1.5 [&_td]:py-0.5 [&_th]:px-1.5 [&_th]:h-7">
      <DataTable rowClick="show" bulkActionButtons={false}>
        <DataTable.Col label={false}>
          <CompanyAvatar width={20} height={20} />
        </DataTable.Col>
        <DataTable.Col source="name" />
        <DataTable.Col source="sector">
          <CompanySectorCell />
        </DataTable.Col>
        <DataTable.Col source="size">
          <CompanySizeCell />
        </DataTable.Col>
        <DataTable.Col source="city" />
        <DataTable.Col source="sales_id">
          <ReferenceField source="sales_id" reference="sales" link={false} />
        </DataTable.Col>
        <DataTable.NumberCol source="nb_contacts" />
        <DataTable.NumberCol source="nb_deals" />
      </DataTable>
    </div>
  );
};

/**
 * The stored `sector` is a raw value (e.g. `"padel_club"`); resolve it
 * against the configured `companySectors` list for its display label, the
 * same lookup `CompanyCard`/`CompanyListFilter` used.
 */
const CompanySectorCell = () => {
  const record = useRecordContext<Company>();
  const { companySectors } = useConfigurationContext();
  if (!record) return null;
  const sector = companySectors.find((s) => s.value === record.sector);
  return <>{sector?.label ?? record.sector}</>;
};

/**
 * The stored `size` is a raw employee-count bucket (e.g. `50`); resolve it
 * to its translated label via the same `getTranslatedCompanySizeLabel` +
 * `sizes` helpers `CompanyListFilter` already uses for the size filter.
 */
const CompanySizeCell = () => {
  const record = useRecordContext<Company>();
  const translate = useTranslate();
  if (!record?.size) return null;
  const size = sizes.find((s) => s.id === record.size);
  if (!size) return null;
  return <>{getTranslatedCompanySizeLabel(size, translate)}</>;
};

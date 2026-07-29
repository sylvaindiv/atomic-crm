import {
  useCreate,
  useGetIdentity,
  useNotify,
  useRecordContext,
  useTranslate,
} from "ra-core";

import type { Company, Contact } from "../../types";
import { EditableReferenceCell } from "./EditableReferenceCell";

/**
 * Table-cell wrapper around `EditableReferenceCell` for the contact's club
 * (`company_id`).
 *
 * Offers the same inline "create new club" affordance as
 * `AutocompleteCompanyInput` (see `companies/AutocompleteCompanyInput.tsx`),
 * reusing its exact create-company request shape.
 */
export const EditableCompanyCell = () => {
  const record = useRecordContext<Contact>();
  const [create] = useCreate<Company>();
  const { identity } = useGetIdentity();
  const notify = useNotify();
  const translate = useTranslate();

  const handleCreateCompany = async (
    name: string,
  ): Promise<Company | undefined> => {
    try {
      const newCompany = await create(
        "companies",
        {
          data: {
            name,
            sales_id: identity?.id,
            created_at: new Date().toISOString(),
          },
        },
        { returnPromise: true },
      );
      return newCompany;
    } catch {
      notify("resources.companies.autocomplete.create_error", {
        type: "error",
        messageArgs: { _: "An error occurred while creating the club" },
      });
      return undefined;
    }
  };

  if (!record) return null;

  return (
    <EditableReferenceCell<Company>
      source="company_id"
      reference="companies"
      label={translate("resources.contacts.fields.company_id")}
      displayValue={record.company_name}
      optionText={(company) => company.name}
      sort={{ field: "name", order: "ASC" }}
      nullable
      onCreate={handleCreateCompany}
      createLabel={(search) =>
        translate("resources.companies.autocomplete.create_item", {
          item: search,
        })
      }
    />
  );
};

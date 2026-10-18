import { useState } from "react";
import { Form, useUpdate } from "ra-core";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { ContactClubsInput } from "../ContactClubs";
import { contactClubIds } from "../contactModel";
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
  const [open, setOpen] = useState(false);
  const [update, { isPending }] = useUpdate<Contact>();
  const [create] = useCreate<Company>();
  const { identity } = useGetIdentity();
  const notify = useNotify();
  const translate = useTranslate();

  const handleCreateCompany = async (
    name: string,
  ): Promise<Company | undefined> => {
    try {
      // useCreate's return type doesn't encode returnPromise as a literal,
      // so it always widens to `ResultRecordType | void` here — but at
      // runtime `returnPromise: true` guarantees a Company, never void.
      const newCompany = (await create(
        "companies",
        {
          data: {
            name,
            sales_id: identity?.id,
            created_at: new Date().toISOString(),
          },
        },
        { returnPromise: true },
      )) as Company;
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

  if (record.contact_type !== "partner")
    return (
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            className="h-8 w-full max-w-64 min-w-0 justify-start text-left"
            title={record.company_name}
            aria-label="Modifier les clubs"
            onClick={(event) => event.stopPropagation()}
          >
            <span className="truncate">{record.company_name || "—"}</span>
          </Button>
        </PopoverTrigger>
        <PopoverContent
          className="w-80"
          onClick={(event) => event.stopPropagation()}
        >
          <Form
            defaultValues={{ company_ids: contactClubIds(record) }}
            onSubmit={async (values: {
              company_ids?: Contact["company_ids"];
            }) => {
              try {
                await update(
                  "contacts",
                  {
                    id: record.id,
                    data: { company_ids: values.company_ids },
                    previousData: record,
                  },
                  { returnPromise: true, mutationMode: "pessimistic" },
                );
                setOpen(false);
              } catch {
                notify("ra.notification.http_error", { type: "error" });
              }
            }}
          >
            <ContactClubsInput />
            <Button type="submit" disabled={isPending}>
              Enregistrer
            </Button>
          </Form>
        </PopoverContent>
      </Popover>
    );

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

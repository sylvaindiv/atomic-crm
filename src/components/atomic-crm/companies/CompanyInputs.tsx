import {
  required,
  useNotify,
  useRecordContext,
  useTranslate,
  useUpdate,
} from "ra-core";
import { ReferenceInput } from "@/components/admin/reference-input";
import { TextInput } from "@/components/admin/text-input";
import { SelectInput } from "@/components/admin/select-input";
import { ArrayInput } from "@/components/admin/array-input";
import { SimpleFormIterator } from "@/components/admin/simple-form-iterator";
import { Separator } from "@/components/ui/separator";
import { useIsMobile } from "@/hooks/use-mobile";

import ImageEditorField from "../misc/ImageEditorField";
import { isLinkedinUrl } from "../misc/isLinkedInUrl";
import { Status } from "../misc/Status";
import { StatusSelector } from "../notes";
import { useConfigurationContext } from "../root/ConfigurationContext";
import type { Company, Sale } from "../types";
import { getTranslatedCompanySizeLabel } from "./getTranslatedCompanySizeLabel";
import { sizes } from "./sizes";

const isUrl = (url: string) => {
  if (!url) return;
  const UrlRegex = new RegExp(
    /^(http:\/\/www\.|https:\/\/www\.|http:\/\/|https:\/\/)?[a-z0-9]+([-.]{1}[a-z0-9]+)*\.[a-z]{2,5}(:[0-9]{1,5})?(\/.*)?$/i,
  );
  if (!UrlRegex.test(url)) {
    return {
      message: "crm.validation.invalid_url",
      args: { _: "Must be a valid URL" },
    };
  }
};

export const CompanyInputs = () => {
  const isMobile = useIsMobile();

  return (
    <div className="flex flex-col gap-4 p-1">
      <CompanyDisplayInputs />
      <CompanyStatusInputs />
      <div className={`flex gap-6 ${isMobile ? "flex-col" : "flex-row"}`}>
        <div className="flex flex-col gap-10 flex-1">
          <CompanyContactInputs />
          <CompanyContextInputs />
        </div>
        <Separator orientation={isMobile ? "horizontal" : "vertical"} />
        <div className="flex flex-col gap-8 flex-1">
          <CompanyAddressInputs />
          <CompanyAdditionalInformationInputs />
        </div>
      </div>
    </div>
  );
};

const CompanyDisplayInputs = () => {
  const translate = useTranslate();
  const record = useRecordContext<Company>();
  return (
    <div className="flex gap-4 flex-1 flex-row">
      <ImageEditorField
        source="logo"
        type="avatar"
        width={60}
        height={60}
        emptyText={record?.name.charAt(0)}
        linkPosition="bottom"
      />
      <TextInput
        source="name"
        className="w-full h-fit"
        validate={required()}
        helperText={false}
        placeholder={translate("resources.companies.fields.name", {
          _: "Club name",
        })}
      />
    </div>
  );
};

/**
 * On the create form there is no record yet, so `CompanyStatusSelector`
 * (which persists via an immediate `update`) has nothing to update -- it
 * renders nothing. Fall back to a plain form-bound `SelectInput` so the
 * status is still settable at creation time and saved by the form's normal
 * submit, exactly like `NoteInputs` does for note status.
 */
const CompanyStatusInputs = () => {
  const translate = useTranslate();
  const record = useRecordContext<Company>();
  const { noteStatuses } = useConfigurationContext();

  return (
    <div className="flex flex-col gap-4">
      <h6 className="text-lg font-semibold">
        {translate("resources.companies.fields.status")}
      </h6>
      {record ? (
        <CompanyStatusSelector />
      ) : (
        <SelectInput
          source="status"
          label={false}
          choices={noteStatuses.map((status) => ({
            id: status.value,
            name: status.label,
            value: status.value,
          }))}
          optionText={statusOptionRenderer}
          helperText={false}
        />
      )}
    </div>
  );
};

const statusOptionRenderer = (choice: { value: string; name: string }) => (
  <div>
    <Status status={choice.value} /> {choice.name}
  </div>
);

const CompanyContactInputs = () => {
  const translate = useTranslate();
  return (
    <div className="flex flex-col gap-4">
      <h6 className="text-lg font-semibold">
        {translate("resources.companies.field_categories.contact", {
          _: "Club info",
        })}
      </h6>
      <TextInput source="website" helperText={false} validate={isUrl} />
      <TextInput
        source="linkedin_url"
        helperText={false}
        validate={isLinkedinUrl}
      />
      <TextInput source="phone_number" helperText={false} />
    </div>
  );
};

const CompanyContextInputs = () => {
  const translate = useTranslate();
  const { companySectors } = useConfigurationContext();
  const translatedSizes = sizes.map((size) => ({
    ...size,
    name: getTranslatedCompanySizeLabel(size, translate),
  }));
  return (
    <div className="flex flex-col gap-4">
      <h6 className="text-lg font-semibold">
        {translate("resources.companies.field_categories.context", {
          _: "Context",
        })}
      </h6>
      <SelectInput
        source="sector"
        choices={companySectors}
        optionText="label"
        optionValue="value"
        helperText={false}
      />
      <SelectInput source="size" choices={translatedSizes} helperText={false} />
      <TextInput source="revenue" helperText={false} />
      <TextInput source="tax_identifier" helperText={false} />
    </div>
  );
};

const CompanyAddressInputs = () => {
  const translate = useTranslate();
  return (
    <div className="flex flex-col gap-4">
      <h6 className="text-lg font-semibold">
        {translate("resources.companies.field_categories.address", {
          _: "Address",
        })}
      </h6>
      <TextInput source="address" helperText={false} />
      <TextInput source="city" helperText={false} />
      <TextInput source="zipcode" helperText={false} />
      <TextInput source="state_abbr" helperText={false} />
      <TextInput source="country" helperText={false} />
    </div>
  );
};

const CompanyAdditionalInformationInputs = () => {
  const translate = useTranslate();
  return (
    <div className="flex flex-col gap-4">
      <h6 className="text-lg font-semibold">
        {translate("resources.companies.field_categories.additional_info", {
          _: "Additional information",
        })}
      </h6>
      <TextInput source="description" multiline helperText={false} />
      <ArrayInput source="context_links" helperText={false}>
        <SimpleFormIterator disableReordering fullWidth getItemLabel={false}>
          <TextInput
            source=""
            label={false}
            helperText={false}
            validate={isUrl}
          />
        </SimpleFormIterator>
      </ArrayInput>
      <ReferenceInput
        source="sales_id"
        reference="sales"
        filter={{
          "disabled@neq": true,
        }}
      >
        <SelectInput helperText={false} optionText={saleOptionRenderer} />
      </ReferenceInput>
    </div>
  );
};

const saleOptionRenderer = (choice: Sale) =>
  `${choice.first_name} ${choice.last_name}`;

/**
 * Status selector for the `companies` resource, modelled on
 * `ContactStatusSelector` (see `contacts/ContactInputs.tsx`): it persists the
 * selection immediately via a normal `update` on `companies` rather than
 * going through the surrounding form's save button, so it also works when
 * embedded outside a form (`CompanyShow.tsx`, `CompanyCard.tsx`).
 *
 * Renders nothing while creating a company (no record/id yet) -- the status
 * only becomes settable once the company exists.
 */
export const CompanyStatusSelector = () => {
  const record = useRecordContext<Company>();
  const [update] = useUpdate<Company>();
  const notify = useNotify();
  if (!record) return null;

  const handleStatusChange = (nextStatus: string) => {
    if (nextStatus === record?.status) return;

    update(
      "companies",
      {
        id: record.id,
        data: { status: nextStatus },
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
  };

  return (
    <div className="[&_button]:w-auto">
      <StatusSelector
        status={record?.status}
        setStatus={handleStatusChange}
        triggerClassName="w-full"
      />
    </div>
  );
};

import { useEffect } from "react";
import { maxLength, required, useRecordContext, useTranslate } from "ra-core";
import { useFormContext, useWatch } from "react-hook-form";
import { AutocompleteArrayInput } from "@/components/admin/autocomplete-array-input";
import { ReferenceArrayInput } from "@/components/admin/reference-array-input";
import { ReferenceInput } from "@/components/admin/reference-input";
import { TextInput } from "@/components/admin/text-input";
import { NumberInput } from "@/components/admin/number-input";
import { DateInput } from "@/components/admin/date-input";
import { SelectInput } from "@/components/admin/select-input";
import { Separator } from "@/components/ui/separator";
import { useIsMobile } from "@/hooks/use-mobile";

import { contactOptionText } from "../misc/ContactOption";
import { useConfigurationContext } from "../root/ConfigurationContext";
import { AutocompleteCompanyInput } from "../companies/AutocompleteCompanyInput.tsx";
import type { Deal } from "../types";

export const DealInputs = () => {
  const isMobile = useIsMobile();
  return (
    <div className="flex flex-col gap-8">
      <DealInfoInputs />

      <div className={`flex gap-6 ${isMobile ? "flex-col" : "flex-row"}`}>
        <DealLinkedToInputs />
        <Separator orientation={isMobile ? "horizontal" : "vertical"} />
        <DealMiscInputs />
      </div>
    </div>
  );
};

// A deal is a judge case or a club case, chosen at creation and immutable
// afterwards -- see DealInputs.tsx ticket notes.
const caseTypeChoices = [
  { value: "judge", label: "resources.deals.case_types.judge" },
  { value: "club", label: "resources.deals.case_types.club" },
];

// Resolves the deal's case_type for both create and edit: the persisted
// record wins once one exists (case_type is immutable after creation), the
// live form value drives the create form before it's saved.
const useDealCaseType = () => {
  const record = useRecordContext<Deal>();
  const { control } = useFormContext();
  const watchedCaseType = useWatch({ control, name: "case_type" });
  return record?.case_type ?? watchedCaseType;
};

// Whether the current deal form is a create form (no persisted record yet).
// Uses a nullish check rather than a truthy one so a record whose id is 0
// (e.g. FakeRest's first seeded deal) is still recognized as an edit form.
const useIsDealCreate = () => {
  const record = useRecordContext<Deal>();
  return record?.id == null;
};

const DealInfoInputs = () => {
  const isCreate = useIsDealCreate();
  return (
    <div className="flex flex-col gap-4 flex-1">
      <TextInput source="name" validate={required()} helperText={false} />
      {isCreate && (
        <SelectInput
          source="case_type"
          label="resources.deals.fields.case_type"
          choices={caseTypeChoices}
          optionText="label"
          optionValue="value"
          helperText={false}
          validate={required()}
        />
      )}
      <TextInput source="description" multiline rows={3} helperText={false} />
    </div>
  );
};

const DealLinkedToInputs = () => {
  const translate = useTranslate();
  const { setValue } = useFormContext();
  const caseType = useDealCaseType();
  const isCreate = useIsDealCreate();

  // Clear the irrelevant link when the user changes case_type while
  // creating a deal, so a stray company_id/contact_ids never rides along
  // with the wrong case type. Not needed on edit: case_type is immutable
  // there, so this branch never switches.
  useEffect(() => {
    if (!isCreate) return;
    if (caseType === "club") {
      setValue("contact_ids", []);
    } else if (caseType === "judge") {
      setValue("company_id", null);
    }
  }, [caseType, isCreate, setValue]);

  return (
    <div className="flex flex-col gap-4 flex-1">
      <h3 className="text-base font-medium">
        {translate("resources.deals.inputs.linked_to")}
      </h3>
      {caseType === "club" && (
        <ReferenceInput source="company_id" reference="companies">
          <AutocompleteCompanyInput
            label="resources.deals.fields.company_id"
            validate={required()}
            modal
          />
        </ReferenceInput>
      )}
      {caseType === "judge" && (
        <ReferenceArrayInput source="contact_ids" reference="contacts_summary">
          <AutocompleteArrayInput
            label="resources.deals.fields.contact_ids"
            optionText={contactOptionText}
            helperText={false}
            validate={[required(), maxLength(1)]}
          />
        </ReferenceArrayInput>
      )}
    </div>
  );
};

const DealMiscInputs = () => {
  const { noteStatuses, dealCategories } = useConfigurationContext();
  const translate = useTranslate();
  return (
    <div className="flex flex-col gap-4 flex-1">
      <h3 className="text-base font-medium">
        {translate("resources.deals.field_categories.misc")}
      </h3>

      <SelectInput
        source="category"
        choices={dealCategories}
        optionText="label"
        optionValue="value"
        helperText={false}
      />
      <NumberInput
        source="amount"
        defaultValue={0}
        helperText={false}
        validate={required()}
      />
      <DateInput
        validate={required()}
        source="expected_closing_date"
        helperText={false}
        defaultValue={new Date().toISOString().split("T")[0]}
      />
      <SelectInput
        source="stage"
        choices={noteStatuses}
        optionText="label"
        optionValue="value"
        defaultValue={noteStatuses[0]?.value}
        helperText={false}
        validate={required()}
      />
    </div>
  );
};

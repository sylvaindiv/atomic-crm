import type { Meta, StoryObj } from "@storybook/react-vite";
import { EditBase, Form, ResourceContextProvider } from "ra-core";

import { DealInputs } from "./DealInputs";
import { SaveButton } from "@/components/admin/form";
import { StoryWrapper } from "@/test/StoryWrapper";
import type { Deal } from "../types";

type DealInputsStoryProps = {
  defaultValues?: Record<string, unknown>;
  record?: Partial<Deal>;
  withSaveButton?: boolean;
};

export const DealInputsStory = ({
  defaultValues,
  record,
  withSaveButton = false,
}: DealInputsStoryProps) => (
  <StoryWrapper
    data={{
      companies: [{ id: 1, name: "Padel Club Paris", sales_id: 0 } as any],
      contacts: [
        {
          id: 1,
          first_name: "Ada",
          last_name: "Lovelace",
          email_jsonb: [],
          phone_jsonb: [],
          tags: [],
        } as any,
      ],
    }}
  >
    <Form defaultValues={defaultValues} record={record as Deal}>
      <DealInputs />
      {withSaveButton ? <SaveButton type="button" /> : null}
    </Form>
  </StoryWrapper>
);

const meta = {
  title: "Atomic CRM/Deals/Deal Inputs",
  includeStories: [
    "Create",
    "EditJudgeDeal",
    "EditClubDeal",
    "EditJudgeDealFromRealRecord",
  ],
  render: (args) => <DealInputsStory {...args} />,
} satisfies Meta<typeof DealInputsStory>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Create: Story = {};

export const EditJudgeDeal: Story = {
  args: {
    record: { id: 42, case_type: "judge", contact_ids: [1] },
  },
};

export const EditClubDeal: Story = {
  args: {
    record: { id: 43, case_type: "club", company_id: 1 },
  },
};

// `EditJudgeDeal` above feeds `DealInputs` a synthetic record via `<Form
// record={...}>`, which is available synchronously and never exercises the
// real EditBase data-fetch path. This story instead seeds a judge deal in
// the FakeRest database and mounts a real `EditBase`, so the "Lie a" section
// resolves `case_type` off the asynchronously fetched record exactly like
// the production `DealEdit` dialog does.
export const EditJudgeDealFromRealRecord = () => (
  <StoryWrapper
    data={{
      deals: [
        {
          id: 21,
          name: "Padel dispute",
          case_type: "judge",
          company_id: null,
          contact_ids: [1],
          category: "other",
          stage: "a_recontacter",
          amount: 500,
          description: "",
          expected_closing_date: "2025-02-01",
          index: 0,
          sales_id: 0,
          created_at: "2025-01-01T00:00:00.000Z",
          updated_at: "2025-01-01T00:00:00.000Z",
        } as any,
      ],
      contacts: [
        {
          id: 1,
          first_name: "Ada",
          last_name: "Lovelace",
          email_jsonb: [],
          phone_jsonb: [],
          tags: [],
        } as any,
      ],
    }}
  >
    <ResourceContextProvider value="deals">
      <EditBase id={21}>
        <Form>
          <DealInputs />
        </Form>
      </EditBase>
    </ResourceContextProvider>
  </StoryWrapper>
);

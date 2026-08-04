import type { Meta, StoryObj } from "@storybook/react-vite";
import { Form } from "ra-core";

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
  includeStories: ["Create", "EditJudgeDeal", "EditClubDeal"],
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

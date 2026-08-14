import type { Meta } from "@storybook/react-vite";

import { DealShow } from "./DealShow";
import { StoryWrapper } from "@/test/StoryWrapper";
import type { Deal } from "../types";

const meta = {
  title: "Atomic CRM/Deals/Deal Show",
} satisfies Meta;

export default meta;

const baseDeal: Deal = {
  amount: 500,
  case_type: "club",
  category: "other",
  company_id: 1,
  contact_ids: [],
  created_at: "2025-01-01T00:00:00.000Z",
  description: "",
  id: 1,
  index: 0,
  name: "Match #12",
  sales_id: 0,
  stage: "a_recontacter",
  updated_at: "2025-01-01T00:00:00.000Z",
};

export const ClubDeal = () => (
  <StoryWrapper
    data={{
      companies: [{ id: 1, name: "Padel Club Paris", sales_id: 0 } as any],
      contacts: [
        {
          id: 2,
          first_name: "Referee",
          last_name: "Contact",
          email_jsonb: [],
          phone_jsonb: [],
          tags: [],
        } as any,
      ],
      deals: [{ ...baseDeal, contact_ids: [2] }],
    }}
  >
    <DealShow open id="1" />
  </StoryWrapper>
);

export const JudgeDeal = () => (
  <StoryWrapper
    data={{
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
      deals: [
        {
          ...baseDeal,
          case_type: "judge",
          company_id: null as unknown as number,
          contact_ids: [1],
        },
      ],
    }}
  >
    <DealShow open id="1" />
  </StoryWrapper>
);

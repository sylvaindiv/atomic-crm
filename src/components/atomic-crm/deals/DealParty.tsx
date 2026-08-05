// Shared judge/club rendering for a deal, reused by DealCard, DealEdit and
// DealShow: a deal is linked to either a company (club case) or a single
// judge (judge case) -- never both, never neither.
import { ReferenceArrayFieldBase, useListContext, useTranslate } from "ra-core";
import { Link as RouterLink } from "react-router";

import { ReferenceField } from "@/components/admin/reference-field";
import { Badge } from "@/components/ui/badge";

import { Avatar as ContactAvatar } from "../contacts/Avatar";
import { CompanyAvatar } from "../companies/CompanyAvatar";
import type { Contact, Deal } from "../types";

type AvatarSize = 20 | 40;

export const DealCaseTypeBadge = ({
  caseType,
}: {
  caseType: Deal["case_type"];
}) => {
  const translate = useTranslate();
  return (
    <Badge variant="secondary">
      {translate(`resources.deals.case_types.${caseType}`)}
    </Badge>
  );
};

export const DealPartyAvatar = ({
  deal,
  width,
  height,
  linkToShow = false,
}: {
  deal: Deal;
  width?: AvatarSize;
  height?: AvatarSize;
  linkToShow?: boolean;
}) => {
  if (deal.case_type === "judge") {
    return (
      <ReferenceArrayFieldBase
        record={deal}
        resource="deals"
        source="contact_ids"
        reference="contacts_summary"
      >
        <JudgePartyAvatar
          width={width}
          height={height}
          linkToShow={linkToShow}
        />
      </ReferenceArrayFieldBase>
    );
  }
  return (
    <ReferenceField
      record={deal}
      resource="deals"
      source="company_id"
      reference="companies"
      link={linkToShow ? "show" : false}
    >
      <CompanyAvatar width={width} height={height} />
    </ReferenceField>
  );
};

export const DealPartyName = ({ deal }: { deal: Deal }) => {
  if (deal.case_type === "judge") {
    return (
      <ReferenceArrayFieldBase
        record={deal}
        resource="deals"
        source="contact_ids"
        reference="contacts_summary"
      >
        <JudgePartyName />
      </ReferenceArrayFieldBase>
    );
  }
  return (
    <ReferenceField
      record={deal}
      resource="deals"
      source="company_id"
      reference="companies"
      link={false}
    />
  );
};

const useJudge = (): Contact | undefined => {
  const { data, isPending } = useListContext<Contact>();
  return isPending ? undefined : data?.[0];
};

const JudgePartyAvatar = ({
  width,
  height,
  linkToShow,
}: {
  width?: AvatarSize;
  height?: AvatarSize;
  linkToShow?: boolean;
}) => {
  const judge = useJudge();
  if (!judge) return null;
  const avatar = <ContactAvatar record={judge} width={width} height={height} />;
  return linkToShow ? (
    <RouterLink to={`/contacts/${judge.id}/show`}>{avatar}</RouterLink>
  ) : (
    avatar
  );
};

const JudgePartyName = () => {
  const judge = useJudge();
  if (!judge) return null;
  return (
    <>
      {judge.first_name} {judge.last_name}
    </>
  );
};

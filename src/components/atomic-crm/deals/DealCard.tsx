import { Draggable } from "@hello-pangea/dnd";
import { differenceInDays } from "date-fns";
import { useRedirect, useTranslate, RecordContextProvider } from "ra-core";
import { NumberField } from "@/components/admin/number-field";
import { SelectField } from "@/components/admin/select-field";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

import { useConfigurationContext } from "../root/ConfigurationContext";
import { isDueTomorrow, isOverdue } from "../tasks/tasksPredicate";
import type { Deal } from "../types";
import { dealNeedsAction } from "./dealUtils";
import { DealPartyAvatar, DealPartyName } from "./DealParty";

export const DealCard = ({ deal, index }: { deal: Deal; index: number }) => {
  if (!deal) return null;

  return (
    <Draggable draggableId={String(deal.id)} index={index}>
      {(provided, snapshot) => (
        <DealCardContent provided={provided} snapshot={snapshot} deal={deal} />
      )}
    </Draggable>
  );
};

export const DealCardContent = ({
  provided,
  snapshot,
  deal,
}: {
  provided?: any;
  snapshot?: any;
  deal: Deal;
}) => {
  const { dealCategories, currency } = useConfigurationContext();
  const redirect = useRedirect();
  const handleClick = () => {
    redirect(`/deals/${deal.id}/show`, undefined, undefined, undefined, {
      _scrollToTop: false,
    });
  };

  return (
    <div
      className="cursor-pointer"
      {...provided?.draggableProps}
      {...provided?.dragHandleProps}
      ref={provided?.innerRef}
      onClick={handleClick}
    >
      <RecordContextProvider value={deal}>
        <Card
          className={`py-2 transition-all duration-200 ${
            snapshot?.isDragging
              ? "opacity-90 transform rotate-1 shadow-lg"
              : "shadow-sm hover:shadow-md"
          }`}
        >
          <CardContent className="px-2 flex flex-col">
            <div className="flex-1 flex">
              <p className="flex-1 text-sm font-medium mb-1">
                <DealPartyName deal={deal} />
                {" - "}
                {deal.name}
              </p>
              <DealPartyAvatar deal={deal} width={20} height={20} />
            </div>
            {deal.case_type === "judge" && deal.club_name && (
              <DealClubSubRow clubName={deal.club_name} />
            )}
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs text-muted-foreground">
                <NumberField
                  source="amount"
                  options={{
                    notation: "compact",
                    style: "currency",
                    currency,
                    currencyDisplay: "narrowSymbol",
                    minimumSignificantDigits: 3,
                  }}
                />
                {deal.category && ", "}
                <SelectField
                  source="category"
                  choices={dealCategories}
                  optionText="label"
                  optionValue="value"
                />
              </p>
              <DealNextActionChip dueDate={deal.next_action_due_date} />
            </div>
          </CardContent>
        </Card>
      </RecordContextProvider>
    </div>
  );
};

// Small muted sub-row showing the referee's club, only for judge deals (a
// club deal's club_name repeats row 1's party name, so it stays hidden there).
const DealClubSubRow = ({ clubName }: { clubName: string }) => {
  const translate = useTranslate();
  return (
    <p className="text-xs text-muted-foreground truncate mb-1">
      <span className="sr-only">
        {translate("resources.deals.fields.club_name")}:{" "}
      </span>
      {clubName}
    </p>
  );
};

const amberChipClassName =
  "border-amber-500 text-amber-700 dark:border-amber-400 dark:text-amber-400";
const greenChipClassName =
  "border-green-500 text-green-700 dark:border-green-400 dark:text-green-400";

// Countdown chip for the deal's next-action due date, colored by urgency
// bucket (see tasksPredicate.ts for the shared overdue/today/tomorrow rules).
const DealNextActionChip = ({ dueDate }: { dueDate?: string | null }) => {
  const translate = useTranslate();
  if (!dueDate) return null;

  if (dealNeedsAction(dueDate)) {
    if (isOverdue(dueDate)) {
      return (
        <Badge variant="destructive">
          {translate("resources.deals.next_action_due.overdue")}
        </Badge>
      );
    }
    return (
      <Badge variant="outline" className={greenChipClassName}>
        {translate("resources.deals.next_action_due.today")}
      </Badge>
    );
  }
  if (isDueTomorrow(dueDate)) {
    return (
      <Badge variant="outline" className={amberChipClassName}>
        {translate("resources.deals.next_action_due.tomorrow")}
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="text-muted-foreground">
      {translate("resources.deals.next_action_due.in_days", {
        smart_count: differenceInDays(new Date(dueDate), new Date()),
      })}
    </Badge>
  );
};

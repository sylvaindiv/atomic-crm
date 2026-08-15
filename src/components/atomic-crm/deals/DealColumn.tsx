import { Droppable } from "@hello-pangea/dnd";

import { useConfigurationContext } from "../root/ConfigurationContext";
import type { Deal } from "../types";
import { Status } from "../misc/Status";
import { DealCard } from "./DealCard";
import { formatDealAmount } from "./dealUtils";

export const DealColumn = ({
  stage,
  deals,
}: {
  stage: string;
  deals: Deal[];
}) => {
  const totalAmount = deals.reduce((sum, deal) => sum + (deal.amount ?? 0), 0);
  const { noteStatuses, currency } = useConfigurationContext();
  const statusOption = noteStatuses.find((status) => status.value === stage);
  return (
    <div className="flex-1 pb-8 px-3">
      <div className="flex flex-col items-center">
        <h3 className="text-base font-medium flex items-center">
          <Status status={stage} />
          {statusOption?.label}
        </h3>
        <p className="text-sm text-muted-foreground">
          {formatDealAmount(totalAmount, currency)}
        </p>
      </div>
      <Droppable droppableId={stage}>
        {(droppableProvided, snapshot) => (
          <div
            ref={droppableProvided.innerRef}
            {...droppableProvided.droppableProps}
            className={`flex flex-col mt-2 divide-y divide-border ${
              snapshot.isDraggingOver ? "bg-muted" : ""
            }`}
          >
            {deals.map((deal, index) => (
              <DealCard key={deal.id} deal={deal} index={index} />
            ))}
            {droppableProvided.placeholder}
          </div>
        )}
      </Droppable>
    </div>
  );
};

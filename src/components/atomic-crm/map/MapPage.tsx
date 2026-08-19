import { MapPin } from "lucide-react";
import { useGetList, useTranslate } from "ra-core";
import { useSearchParams } from "react-router";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";

import { FilterCategory } from "../filters/FilterCategory";
import { Status } from "../misc/Status";
import MobileHeader from "../layout/MobileHeader";
import { MobileBackButton } from "../misc/MobileBackButton";
import { MobileContent } from "../layout/MobileContent";
import { useConfigurationContext } from "../root/ConfigurationContext";
import type { Contact } from "../types";
import { ContactMap } from "./ContactMap";
import { useGeocodedContacts } from "./useGeocodedContacts";

export const MapPage = () => {
  const translate = useTranslate();
  const isMobile = useIsMobile();
  const { noteStatuses } = useConfigurationContext();
  const [searchParams, setSearchParams] = useSearchParams();

  const { data: contacts, isPending: isLoadingContacts } = useGetList<Contact>(
    "contacts",
    {
      pagination: { page: 1, perPage: 2000 },
      sort: { field: "id", order: "ASC" },
    },
  );

  const { points, isPending: isGeocoding } = useGeocodedContacts(contacts);

  const allStatusValues = noteStatuses.map((s) => s.value);
  const statusParam = searchParams.get("status");
  const selectedStatuses = statusParam
    ? statusParam.split(",")
    : allStatusValues;

  const toggleStatus = (value: string) => {
    const next = selectedStatuses.includes(value)
      ? selectedStatuses.filter((s) => s !== value)
      : [...selectedStatuses, value];

    const params = new URLSearchParams(searchParams);
    if (next.length === allStatusValues.length) {
      params.delete("status");
    } else {
      params.set("status", next.join(","));
    }
    setSearchParams(params, { replace: true });
  };

  const filteredPoints = points.filter((p) =>
    selectedStatuses.includes(p.contact.status),
  );

  const isPending = isLoadingContacts || isGeocoding;

  const content = (
    <div className="flex flex-col md:flex-row gap-4 h-full">
      <div className="md:w-64 shrink-0">
        <FilterCategory label="resources.notes.fields.status" icon={<MapPin />}>
          {noteStatuses.map((status) => (
            <Button
              key={status.value}
              type="button"
              variant="ghost"
              className={cn(
                "w-auto md:w-full justify-start h-10 md:h-8",
                selectedStatuses.includes(status.value) &&
                  "bg-neutral-300 hover:bg-neutral-300 dark:bg-neutral-600 dark:hover:bg-neutral-600",
              )}
              onClick={() => toggleStatus(status.value)}
            >
              <Status status={status.value} />
              {status.label}
            </Button>
          ))}
        </FilterCategory>
      </div>
      <div
        className={cn(
          "flex-1 min-h-[60vh] md:min-h-0 relative",
          isPending && "opacity-50",
        )}
      >
        {isPending && (
          <div className="absolute inset-0 z-[1000] flex items-center justify-center">
            <Spinner />
          </div>
        )}
        {!isPending && filteredPoints.length === 0 ? (
          <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
            {translate("crm.map.empty", {
              _: "No contact could be located on the map.",
            })}
          </div>
        ) : (
          <ContactMap points={filteredPoints} />
        )}
      </div>
    </div>
  );

  if (isMobile) {
    return (
      <>
        <MobileHeader>
          <MobileBackButton to="/settings" />
          <div className="flex flex-1 min-w-0">
            <h1 className="text-xl font-semibold">
              {translate("crm.map.title")}
            </h1>
          </div>
        </MobileHeader>
        <MobileContent>{content}</MobileContent>
      </>
    );
  }

  return (
    <div className="mx-auto my-4 px-4 h-[calc(100vh-8rem)]">
      <h1 className="text-2xl font-semibold mb-4">
        {translate("crm.map.title")}
      </h1>
      {content}
    </div>
  );
};

MapPage.path = "/map";

import {
  InfiniteListBase,
  RecordContextProvider,
  useListContext,
  useTranslate,
} from "ra-core";
import { Link } from "react-router";

import { InfinitePagination } from "../misc/InfinitePagination";
import { useConfigurationContext } from "../root/ConfigurationContext";
import type { Contact } from "../types";
import { useUpdateContactField } from "../contacts/table/useUpdateContactField";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import MobileHeader from "../layout/MobileHeader";
import { MobileContent } from "../layout/MobileContent";
import { useIsMobile } from "@/hooks/use-mobile";

export const ClientsPage = () => (
  <InfiniteListBase
    resource="contacts"
    perPage={25}
    sort={{ field: "last_name", order: "ASC" }}
    filter={{ status: "client", contact_type: "referee" }}
    disableSyncWithLocation
    storeKey="clients.listParams"
  >
    <ClientsList />
  </InfiniteListBase>
);

ClientsPage.path = "/clients";

const ClientsList = () => {
  const { data = [], isPending } = useListContext<Contact>();
  const translate = useTranslate();
  const isMobile = useIsMobile();

  const content = (
    <>
      {isPending ? null : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {data.map((contact) => (
            <RecordContextProvider key={contact.id} value={contact}>
              <ClientCard contact={contact} />
            </RecordContextProvider>
          ))}
        </div>
      )}
      {!isPending && data.length === 0 && (
        <p className="text-muted-foreground">
          {translate("crm.clients.empty", { _: "No clients yet" })}
        </p>
      )}
      <div className="flex justify-center">
        <InfinitePagination />
      </div>
    </>
  );

  if (isMobile) {
    return (
      <>
        <MobileHeader>
          <h1 className="text-xl font-semibold">
            {translate("crm.clients.title", { _: "Clients" })}
          </h1>
        </MobileHeader>
        <MobileContent>{content}</MobileContent>
      </>
    );
  }

  return (
    <div className="mx-auto my-4 px-4">
      <h1 className="text-2xl font-semibold mb-4">
        {translate("crm.clients.title", { _: "Clients" })}
      </h1>
      {content}
    </div>
  );
};

const ClientCard = ({ contact }: { contact: Contact }) => {
  const checklist = useConfigurationContext().clientChecklist;
  const selected = contact.client_checklist ?? [];
  const completed = checklist.filter((item) =>
    selected.includes(item.value),
  ).length;
  const translate = useTranslate();
  const name = `${contact.first_name} ${contact.last_name}`.trim();

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle>
          <Link
            to={`/contacts/${contact.id}/show`}
            className="text-lg font-semibold hover:underline focus-visible:underline"
          >
            {name}
          </Link>
        </CardTitle>
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <Progress
            value={checklist.length ? (completed / checklist.length) * 100 : 0}
            aria-label={translate("crm.clients.checklist.progress_label")}
          />
          <span className="shrink-0">
            {translate("crm.clients.checklist.progress", {
              _: `${completed} / ${checklist.length} completed`,
              completed,
              total: checklist.length,
            })}
          </span>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {checklist.map((item) => (
          <ChecklistRow
            key={item.value}
            id={`${contact.id}-${item.value}`}
            label={item.label}
            value={item.value}
            selected={selected}
            checked={selected.includes(item.value)}
          />
        ))}
      </CardContent>
    </Card>
  );
};

const ChecklistRow = ({
  id,
  label,
  value,
  selected,
  checked,
}: {
  id: string;
  label: string;
  value: string;
  selected: string[];
  checked: boolean;
}) => {
  const updateChecklist = useUpdateContactField("client_checklist");

  return (
    <div className="flex items-start gap-2">
      <Checkbox
        id={id}
        checked={checked}
        onCheckedChange={(nextChecked) => {
          const next =
            nextChecked === true
              ? [...new Set([...selected, value])]
              : selected.filter((item) => item !== value);
          updateChecklist(next);
        }}
        className="mt-0.5"
      />
      <label htmlFor={id} className="cursor-pointer text-sm leading-5">
        {label}
      </label>
    </div>
  );
};

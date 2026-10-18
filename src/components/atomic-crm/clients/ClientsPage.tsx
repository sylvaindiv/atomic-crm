import {
  InfiniteListBase,
  useCreate,
  useDelete,
  useGetList,
  useGetMany,
  useListContext,
  useNotify,
  useTranslate,
  useUpdate,
} from "ra-core";
import { useEffect, useState } from "react";
import { ChevronDown, ChevronRight, Plus, X } from "lucide-react";
import { Link } from "react-router";

import { InfinitePagination } from "../misc/InfinitePagination";
import { useConfigurationContext } from "../root/ConfigurationContext";
import type { Company, Contact, LabeledValue } from "../types";
import type { Identifier } from "ra-core";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import MobileHeader from "../layout/MobileHeader";
import { MobileContent } from "../layout/MobileContent";
import { useIsMobile } from "@/hooks/use-mobile";

type ClubReferee = {
  id: number;
  company_id: Identifier;
  contact_id: Identifier;
  client_checklist: string[];
};

export const ClientsPage = () => (
  <InfiniteListBase
    resource="companies"
    perPage={25}
    sort={{ field: "name", order: "ASC" }}
    filter={{ is_client: true }}
    disableSyncWithLocation
    storeKey="clients.listParams"
  >
    <ClientsList />
  </InfiniteListBase>
);

ClientsPage.path = "/clients";

const ClientsList = () => {
  const {
    data = [],
    total = 0,
    isPending,
    error,
    refetch,
  } = useListContext<Company>();
  const translate = useTranslate();
  const isMobile = useIsMobile();
  const [openIds, setOpenIds] = useState<Set<string>>(new Set());
  const [openedDefault, setOpenedDefault] = useState(false);
  useEffect(() => {
    if (!openedDefault && data.length) {
      setOpenIds(new Set([String(data[0].id)]));
      setOpenedDefault(true);
    }
  }, [data, openedDefault]);

  const content = (
    <>
      {error ? (
        <div className="flex items-center gap-3 py-5" role="alert">
          <p className="text-sm text-destructive">
            {translate("ra.page.error", { _: "Could not load clients" })}
          </p>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            {translate("ra.action.retry", { _: "Réessayer" })}
          </Button>
        </div>
      ) : isPending ? (
        <p className="py-5 text-sm text-muted-foreground">
          {translate("ra.message.loading", { _: "Loading…" })}
        </p>
      ) : data.length ? (
        <div className="divide-y rounded-md border-y">
          {data.map((company) => (
            <ClubRow
              key={company.id}
              company={company}
              expanded={openIds.has(String(company.id))}
              onToggle={() =>
                setOpenIds((current) => {
                  const next = new Set(current);
                  if (next.has(String(company.id)))
                    next.delete(String(company.id));
                  else next.add(String(company.id));
                  return next;
                })
              }
            />
          ))}
        </div>
      ) : (
        <p className="py-5 text-sm text-muted-foreground">
          {translate("crm.clients.empty", { _: "Aucun club client" })}
        </p>
      )}
      <div className="flex justify-center">
        <InfinitePagination />
      </div>
    </>
  );

  const header = (
    <div className="flex min-w-0 items-center gap-2">
      <h1 className="text-xl font-semibold">
        {translate("crm.clients.title", { _: "Clients" })}
      </h1>
      <span className="text-sm text-muted-foreground">({total})</span>
    </div>
  );
  const edit = (
    <Button
      variant={isMobile ? "ghost" : "outline"}
      size={isMobile ? "sm" : "default"}
      asChild
    >
      <Link to="/settings/clients">
        {translate("crm.clients.checklist.edit", { _: "Modifier les étapes" })}
      </Link>
    </Button>
  );
  if (isMobile)
    return (
      <>
        <MobileHeader>
          {header}
          {edit}
        </MobileHeader>
        <MobileContent>{content}</MobileContent>
      </>
    );
  return (
    <div className="mx-auto my-4 px-4">
      <div className="mb-4 flex items-center justify-between gap-4">
        {header}
        {edit}
      </div>
      {content}
    </div>
  );
};

const ClubRow = ({
  company,
  expanded,
  onToggle,
}: {
  company: Company;
  expanded: boolean;
  onToggle: () => void;
}) => {
  const translate = useTranslate();
  const [update] = useUpdate<Company>();
  const notify = useNotify();
  const [busy, setBusy] = useState(false);
  const selected = company.client_checklist ?? [];
  const steps = useConfigurationContext().clubChecklist;
  const completed = steps.filter((step) =>
    selected.includes(step.value),
  ).length;
  const refs = useGetList<ClubReferee>(
    "club_referees",
    {
      filter: { company_id: company.id },
      pagination: { page: 1, perPage: 250 },
      sort: { field: "id", order: "ASC" },
    },
    { enabled: expanded },
  );
  const refereeContacts = useGetMany<Contact>(
    "contacts",
    { ids: (refs.data ?? []).map((ref) => ref.contact_id) },
    { enabled: expanded && Boolean(refs.data?.length) },
  );
  const contactNames = new Map(
    (refereeContacts.data ?? []).map((contact) => [
      String(contact.id),
      `${contact.first_name ?? ""} ${contact.last_name ?? ""}`.trim(),
    ]),
  );
  const sortedRefs = [...(refs.data ?? [])].sort((left, right) =>
    (contactNames.get(String(left.contact_id)) ?? "").localeCompare(
      contactNames.get(String(right.contact_id)) ?? "",
    ),
  );

  const save = (next: string[]) => {
    if (busy) return;
    setBusy(true);
    update(
      "companies",
      {
        id: company.id,
        data: { client_checklist: next },
        previousData: company,
      },
      {
        mutationMode: "pessimistic",
        onError: (error) =>
          notify(error?.message ?? "ra.notification.http_error", {
            type: "error",
          }),
        onSettled: () => setBusy(false),
      },
    );
  };

  return (
    <section className="py-3">
      <div className="flex min-w-0 items-start gap-2 md:items-center">
        <button
          type="button"
          aria-expanded={expanded}
          aria-label={expanded ? "Réduire le club" : "Déplier le club"}
          onClick={onToggle}
          className="mt-0.5 rounded p-1 hover:bg-muted focus-visible:outline-none focus-visible:ring-2 md:mt-0"
        >
          {expanded ? (
            <ChevronDown className="size-4" />
          ) : (
            <ChevronRight className="size-4" />
          )}
        </button>
        <Link
          to={`/companies/${company.id}/show`}
          className="min-w-0 flex-1 break-words text-sm font-semibold hover:underline"
        >
          {company.name}
        </Link>
        {steps.length > 0 && (
          <span className="shrink-0 text-xs text-muted-foreground">
            {completed}/{steps.length}
          </span>
        )}
      </div>
      {expanded && (
        <div className="ml-7 mt-3 space-y-4">
          <Checklist
            steps={steps}
            selected={selected}
            busy={busy}
            onChange={save}
            idPrefix={`club-${company.id}`}
          />
          <div className="border-l pl-3">
            <div className="mb-2 flex items-center justify-between gap-2">
              <h2 className="text-sm font-medium">
                {translate("crm.clients.referees", { _: "Juges-arbitres" })}
              </h2>
              <AddReferee
                company={company}
                linkedIds={(refs.data ?? []).map((ref) => ref.contact_id)}
              />
            </div>
            {refs.isPending ? (
              <p className="text-sm text-muted-foreground">
                {translate("ra.message.loading", { _: "Loading…" })}
              </p>
            ) : refs.error ? (
              <div className="flex items-center gap-2">
                <p className="text-sm text-destructive">
                  {translate("ra.page.error", { _: "Could not load referees" })}
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => refs.refetch()}
                >
                  {translate("ra.action.retry", { _: "Réessayer" })}
                </Button>
              </div>
            ) : sortedRefs.length ? (
              <div className="divide-y">
                {sortedRefs.map((ref) => (
                  <RefereeRow
                    key={ref.id}
                    link={ref}
                    companyId={company.id}
                    contact={refereeContacts.data?.find(
                      (person) => String(person.id) === String(ref.contact_id),
                    )}
                  />
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                {translate("crm.clients.no_referees", {
                  _: "Aucun juge-arbitre suivi",
                })}
              </p>
            )}
          </div>
        </div>
      )}
    </section>
  );
};

const RefereeRow = ({
  link,
  companyId,
  contact,
}: {
  link: ClubReferee;
  companyId: Identifier;
  contact?: Contact;
}) => {
  const translate = useTranslate();
  const steps = useConfigurationContext().refereeChecklist;
  const [update] = useUpdate<ClubReferee>();
  const [remove] = useDelete();
  const notify = useNotify();
  const [busy, setBusy] = useState(false);
  const selected = link.client_checklist ?? [];
  const completed = steps.filter((step) =>
    selected.includes(step.value),
  ).length;
  const name = contact
    ? `${contact.first_name ?? ""} ${contact.last_name ?? ""}`.trim()
    : "…";
  const save = (next: string[]) => {
    if (busy) return;
    setBusy(true);
    update(
      "club_referees",
      { id: link.id, data: { client_checklist: next }, previousData: link },
      {
        mutationMode: "pessimistic",
        onError: (error) =>
          notify(
            error instanceof Error
              ? error.message
              : "ra.notification.http_error",
            { type: "error" },
          ),
        onSettled: () => setBusy(false),
      },
    );
  };
  const removeLink = () => {
    if (
      selected.length &&
      !window.confirm(
        translate("crm.clients.remove_confirm", {
          _: "Retirer ce juge-arbitre et ses cases de ce club ?",
        }),
      )
    )
      return;
    remove(
      "club_referees",
      { id: link.id, previousData: link },
      {
        mutationMode: "pessimistic",
        onError: (error) =>
          notify(
            error instanceof Error
              ? error.message
              : "ra.notification.http_error",
            { type: "error" },
          ),
      },
    );
  };
  return (
    <div className="py-3">
      <div className="mb-2 flex items-center gap-2">
        <Link
          to={`/contacts/${link.contact_id}/show`}
          className="min-w-0 flex-1 break-words text-sm font-medium hover:underline"
        >
          {name}
        </Link>
        {steps.length > 0 && (
          <span className="text-xs text-muted-foreground">
            {translate("crm.clients.checklist.progress_compact", {
              _: `${completed}/${steps.length}`,
              completed,
              total: steps.length,
            })}
          </span>
        )}
        <Button
          variant="ghost"
          size="icon"
          className="size-7"
          aria-label={translate("crm.clients.remove_referee", {
            _: "Retirer le suivi",
          })}
          onClick={removeLink}
        >
          <X className="size-4" />
        </Button>
      </div>
      <Checklist
        steps={steps}
        selected={selected}
        busy={busy}
        onChange={save}
        idPrefix={`ref-${companyId}-${link.id}`}
      />
    </div>
  );
};

const Checklist = ({
  steps,
  selected,
  busy,
  onChange,
  idPrefix,
}: {
  steps: LabeledValue[];
  selected: string[];
  busy: boolean;
  onChange: (next: string[]) => void;
  idPrefix: string;
}) => {
  if (!steps.length) return null;
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:gap-x-5">
      {steps.map((step) => {
        const checked = selected.includes(step.value);
        const id = `${idPrefix}-${step.value}`;
        return (
          <div key={step.value} className="flex min-w-0 items-start gap-2">
            <Checkbox
              id={id}
              checked={checked}
              disabled={busy}
              onCheckedChange={(next) =>
                onChange(
                  next === true
                    ? [...selected, step.value]
                    : selected.filter((value) => value !== step.value),
                )
              }
              className="mt-0.5"
            />
            <label
              htmlFor={id}
              className="min-w-0 break-words text-sm leading-5"
            >
              {step.label}
            </label>
          </div>
        );
      })}
    </div>
  );
};

const AddReferee = ({
  company,
  linkedIds,
}: {
  company: Company;
  linkedIds: Identifier[];
}) => {
  const translate = useTranslate();
  const notify = useNotify();
  const [create, { isPending }] = useCreate();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const results = useGetList<Contact>(
    "contacts",
    {
      filter: { contact_type: "referee" },
      pagination: { page: 1, perPage: 250 },
      sort: { field: "last_name", order: "ASC" },
    },
    { enabled: open },
  );
  const candidates = (results.data ?? []).filter(
    (person) =>
      !linkedIds.some((id) => String(id) === String(person.id)) &&
      `${person.first_name ?? ""} ${person.last_name ?? ""}`
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  const add = (person: Contact) =>
    create(
      "club_referees",
      {
        data: {
          company_id: company.id,
          contact_id: person.id,
          client_checklist: [],
        },
      },
      {
        mutationMode: "pessimistic",
        onSuccess: () => {
          setQuery("");
          setOpen(false);
        },
        onError: (error) =>
          notify(
            error instanceof Error
              ? error.message
              : "ra.notification.http_error",
            { type: "error" },
          ),
      },
    );
  return (
    <div className="relative">
      <Button
        variant="ghost"
        size="sm"
        className="h-8 px-2"
        onClick={() => setOpen(!open)}
      >
        <Plus className="mr-1 size-4" />
        {translate("crm.clients.add_referee", { _: "Ajouter un juge-arbitre" })}
      </Button>
      {open && (
        <div className="absolute right-0 z-10 mt-1 w-[min(20rem,calc(100vw-3rem))] rounded-md border bg-popover p-2 shadow-md">
          <Input
            autoFocus
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={translate("crm.clients.search_referee", {
              _: "Rechercher un contact",
            })}
          />
          <div className="mt-2 max-h-52 overflow-y-auto">
            {results.isPending ? (
              <p className="p-2 text-sm text-muted-foreground">
                {translate("ra.message.loading", { _: "Loading…" })}
              </p>
            ) : (
              candidates.slice(0, 20).map((person) => (
                <button
                  key={person.id}
                  type="button"
                  disabled={isPending}
                  onClick={() => add(person)}
                  className="block w-full rounded p-2 text-left text-sm hover:bg-muted"
                >
                  {`${person.first_name ?? ""} ${person.last_name ?? ""}`.trim()}
                </button>
              ))
            )}
            {!results.isPending && !candidates.length && (
              <p className="p-2 text-sm text-muted-foreground">
                {translate("ra.navigation.no_results", { _: "Aucun résultat" })}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

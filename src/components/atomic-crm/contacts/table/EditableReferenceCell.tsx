import { useDeferredValue, useState } from "react";
import {
  useGetList,
  useRecordContext,
  type Identifier,
  type RaRecord,
  type SortPayload,
} from "ra-core";
import { Check, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

import type { Contact } from "../../types";
import { useUpdateContactField } from "./useUpdateContactField";

/** Contact columns holding a single foreign key, safe for this generic picker. */
type ReferenceField = "company_id" | "referred_by_id" | "sales_id";

export interface EditableReferenceCellProps<
  RecordType extends RaRecord = RaRecord,
> {
  /** Contact column this cell reads and commits to. */
  source: ReferenceField;
  /** Resource the popover's options are fetched from (e.g. "companies"). */
  reference: string;
  /** Accessible name for the trigger — a dense table cell has no visible label of its own. */
  label: string;
  /**
   * Label shown in the closed cell. Pass the denormalized column
   * (`company_name` / `referred_by_name`) to avoid a per-row lookup; leave
   * it unset for small `alwaysFetch` references (e.g. sales) — the label is
   * then resolved from the already-fetched choices instead.
   */
  displayValue?: string | null;
  /** Renders one option's label, in the popover list and once selected. */
  optionText: (record: RecordType) => string;
  /** Sort applied to the fetched choices. Defaults to id ascending. */
  sort?: SortPayload;
  /** Extra filter merged into every list query (self-exclusion, disabled@neq...). */
  filter?: Record<string, unknown>;
  /**
   * Offers a leading option that resets the field to null. Only for
   * nullable columns (company_id, referred_by_id) — never sales_id, which
   * is required.
   */
  nullable?: boolean;
  /**
   * true: fetch a bounded full list once — shared across every row through
   * the query cache, the same trick `useTags` uses — and let the popover
   * filter it client-side; for small reference tables (sales). false
   * (default): fetch a short page lazily while the popover is open,
   * re-querying the server with the typed text as `q`; for larger
   * searchable references (companies, contacts).
   */
  alwaysFetch?: boolean;
  /** Inline "create new <search>" affordance (company only). */
  onCreate?: (search: string) => Promise<RecordType | undefined>;
  /** Renders the create-option's label for the current search text. */
  createLabel?: (search: string) => string;
}

/**
 * Generic single-foreign-key popover picker for a contacts table cell.
 *
 * Shows a denormalized/resolved label until clicked, then opens a Radix
 * popover — portaled to `document.body`, so it never touches the row's DOM
 * subtree — with a search box and a list of options fetched from
 * `reference`; selecting one commits immediately through
 * `useUpdateContactField`. Hand-rolled — no `admin/*-input.tsx`, no ra-core
 * `useInput()` — because a `DataTable.Col` cell has no surrounding
 * react-hook-form `<Form>` for those to bind to.
 */
export function EditableReferenceCell<RecordType extends RaRecord = RaRecord>({
  source,
  reference,
  label,
  displayValue,
  optionText,
  sort = { field: "id", order: "ASC" },
  filter,
  nullable = false,
  alwaysFetch = false,
  onCreate,
  createLabel,
}: EditableReferenceCellProps<RecordType>) {
  const record = useRecordContext<Contact>();
  const updateField = useUpdateContactField(source);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);

  const listFilter = {
    ...filter,
    ...(!alwaysFetch && deferredSearch ? { q: deferredSearch } : {}),
  };

  const { data: choices } = useGetList<RecordType>(
    reference,
    {
      pagination: { page: 1, perPage: alwaysFetch ? 1000 : 25 },
      sort,
      filter: listFilter,
    },
    { enabled: alwaysFetch || open },
  );

  if (!record) return null;

  const value = record[source];
  const selectedChoice = choices?.find((choice) => choice.id === value);
  const resolvedLabel =
    displayValue ?? (selectedChoice ? optionText(selectedChoice) : undefined);
  const accessibleName = resolvedLabel ? `${label}: ${resolvedLabel}` : label;

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (!nextOpen) setSearch("");
  };

  const handleSelect = (id: Identifier | null) => {
    setOpen(false);
    setSearch("");
    updateField(id);
  };

  const handleCreate = async () => {
    if (!onCreate || !search) return;
    const created = await onCreate(search);
    if (created) handleSelect(created.id);
  };

  return (
    <div onClick={(event) => event.stopPropagation()}>
      <Popover open={open} onOpenChange={handleOpenChange}>
        <PopoverTrigger asChild>
          <button
            type="button"
            aria-label={accessibleName}
            className={cn(
              "block w-full truncate rounded px-2 py-1 text-left hover:bg-accent",
              !resolvedLabel && "text-muted-foreground",
            )}
          >
            {resolvedLabel || "—"}
          </button>
        </PopoverTrigger>
        <PopoverContent className="p-0" align="start">
          <Command shouldFilter={alwaysFetch}>
            <CommandInput
              placeholder="Search..."
              value={search}
              onValueChange={setSearch}
            />
            <CommandList>
              <CommandEmpty>No matching item found.</CommandEmpty>
              <CommandGroup>
                {nullable && (
                  <CommandItem
                    value="__clear__"
                    aria-label="Clear"
                    onSelect={() => handleSelect(null)}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        value == null ? "opacity-100" : "opacity-0",
                      )}
                    />
                    <span className="text-muted-foreground">—</span>
                  </CommandItem>
                )}
                {choices?.map((choice) => {
                  const text = optionText(choice);
                  return (
                    <CommandItem
                      key={choice.id}
                      value={String(choice.id)}
                      keywords={[text]}
                      onSelect={() => handleSelect(choice.id)}
                    >
                      <Check
                        className={cn(
                          "mr-2 h-4 w-4",
                          value === choice.id ? "opacity-100" : "opacity-0",
                        )}
                      />
                      {text}
                    </CommandItem>
                  );
                })}
                {onCreate && search && (
                  <CommandItem
                    value={`__create__${search}`}
                    onSelect={handleCreate}
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    {createLabel ? createLabel(search) : search}
                  </CommandItem>
                )}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}

import {
  useState,
  useEffect,
  Children,
  createContext,
  isValidElement,
  useContext,
  type ComponentProps,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import * as diacritic from "diacritic";
import {
  useDataTableStoreContext,
  useStore,
  useTranslate,
  useResourceContext,
  useDataTableColumnRankContext,
  useDataTableColumnFilterContext,
  useTranslateLabel,
  DataTableColumnRankContext,
  DataTableColumnFilterContext,
  type RaRecord,
  type Identifier,
  type SortPayload,
  type HintedString,
  type ExtractRecordPaths,
} from "ra-core";
import { Columns, Search } from "lucide-react";
import * as PopoverPrimitive from "@radix-ui/react-popover";
import { useIsMobile } from "@/hooks/use-mobile";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FieldToggle } from "@/components/admin/field-toggle";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Popover, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import {
  orderedColumnIds,
  useColumnPreferences,
} from "./column-preferences-context";

const ColumnIdsContext = createContext<string[]>([]);

/**
 * Renders a button that lets users show / hide columns in a DataTable
 *
 * @see {@link https://marmelab.com/shadcn-admin-kit/docs/columnsbutton/ ColumnsButton documentation}
 *
 * @example
 * import { List, DataTable, EditButton, CreateButton, ExportButton, ColumnsButton } from '@/components/admin';
 *
 * const PostsList = () => (
 *   <List
 *     actions={<>
 *       <ColumnsButton />
 *       <CreateButton />
 *       <ExportButton />
 *     </>}
 *   >
 *     <DataTable>
 *       <DataTable.Col source="title" />
 *       <DataTable.Col source="body" />
 *       <DataTable.Col source="updated_at" />
 *       <EditButton />
 *     </DataTable>
 *   </List>
 * );
 */
export const ColumnsButton = (props: ColumnsButtonProps) => {
  const { className, storeKey: _, ...rest } = props;
  const resource = useResourceContext(props);
  const storeKey = props.storeKey || `${resource}.datatable`;

  const [open, setOpen] = useState(false);
  const isMobile = useIsMobile();
  const translate = useTranslate();

  const title = translate("ra.action.select_columns", { _: "Columns" });

  return (
    <span className={cn("inline-flex", className)}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          {isMobile ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={title}
                  {...rest}
                >
                  <Columns className="size-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>{title}</TooltipContent>
            </Tooltip>
          ) : (
            <Button variant="outline" className="cursor-pointer" {...rest}>
              <Columns />
              {title}
            </Button>
          )}
        </PopoverTrigger>
        <PopoverPrimitive.Portal forceMount>
          <div
            className={open ? "block" : "hidden pointer-events-none"}
            // Belt-and-suspenders on top of the Tailwind classes above: an
            // inline style can't be defeated by a missed JIT-scan or a
            // higher-specificity rule elsewhere, so the closed, forceMount'd
            // popover is guaranteed inert (invisible, non-interactive) even
            // if the class-based hiding somehow isn't taking effect.
            style={
              open ? undefined : { display: "none", pointerEvents: "none" }
            }
          >
            <PopoverPrimitive.Content
              data-slot="popover-content"
              sideOffset={4}
              align="start"
              className="bg-popover text-popover-foreground data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 z-50 w-72 origin-(--radix-popover-content-transform-origin) rounded-md border shadow-md outline-hidden p-0 min-w-[200px]"
              // Radix's own Content may set its own pointer-events on this
              // exact element (e.g. for focus/dismiss handling); repeat the
              // inline style here directly rather than relying only on
              // inheritance from the wrapper div above.
              style={open ? undefined : { pointerEvents: "none" }}
            >
              <div id={`${storeKey}-columnsSelector`} className="p-2" />
            </PopoverPrimitive.Content>
          </div>
        </PopoverPrimitive.Portal>
      </Popover>
    </span>
  );
};

export interface ColumnsButtonProps extends ComponentProps<typeof Button> {
  resource?: string;
  storeKey?: string;
}

/**
 * Render DataTable.Col elements in the ColumnsButton selector using a React Portal.
 *
 * @see ColumnsButton
 */
export const ColumnsSelector = ({ children }: ColumnsSelectorProps) => {
  const preferences = useColumnPreferences();
  const translate = useTranslate();
  const { storeKey, defaultHiddenColumns } = useDataTableStoreContext();
  const [columnRanks, setColumnRanks] = useStore<number[] | undefined>(
    `${storeKey}_columnRanks`,
  );
  const [_hiddenColumns, setHiddenColumns] = useStore<string[]>(
    storeKey,
    defaultHiddenColumns,
  );
  const elementId = `${storeKey}-columnsSelector`;

  const [container, setContainer] = useState<HTMLElement | null>(() =>
    typeof document !== "undefined" ? document.getElementById(elementId) : null,
  );

  // on first mount, we don't have the container yet, so we wait for it
  useEffect(() => {
    if (
      container &&
      typeof document !== "undefined" &&
      document.body.contains(container)
    )
      return;
    // look for the container in the DOM every 100ms
    const interval = setInterval(() => {
      const target = document.getElementById(elementId);
      if (target) setContainer(target);
    }, 100);
    // stop looking after 500ms
    const timeout = setTimeout(() => clearInterval(interval), 500);
    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, [elementId, container]);

  const [columnFilter, setColumnFilter] = useState<string>("");

  if (!container) return null;

  const childrenArray = Children.toArray(children);
  const ids = childrenArray.map((child, index) =>
    isValidElement<{ source?: string }>(child)
      ? (child.props.source ?? `column_${index}`)
      : `column_${index}`,
  );
  const paddedColumnRanks = preferences
    ? orderedColumnIds(ids, preferences.settings.order).map((id) =>
        ids.indexOf(id),
      )
    : padRanks(columnRanks ?? [], childrenArray.length);
  const shouldDisplaySearchInput = childrenArray.length > 5;

  return createPortal(
    <div>
      {preferences && !preferences.ready && (
        <div className="p-2 text-sm">
          {preferences.error
            ? "Impossible de charger les colonnes."
            : "Chargement des colonnes…"}
          {preferences.error && (
            <Button size="sm" variant="outline" onClick={preferences.retry}>
              Réessayer
            </Button>
          )}
        </div>
      )}
      {preferences?.saveError && (
        <div className="p-2 text-sm">
          Sauvegarde échouée.{" "}
          <Button size="sm" variant="outline" onClick={preferences.retry}>
            Réessayer
          </Button>
        </div>
      )}
      {(!preferences || preferences.ready) && (
        <>
          {shouldDisplaySearchInput && (
            <div className="relative p-1">
              <Input
                value={columnFilter}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                  setColumnFilter(e.target.value);
                }}
                placeholder={translate("ra.action.search_columns", {
                  _: "Search columns",
                })}
                className="pr-8"
              />
              <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              {columnFilter && (
                <button
                  onClick={() => setColumnFilter("")}
                  className="absolute right-8 top-2 h-4 w-4 text-muted-foreground"
                  aria-label="Clear"
                >
                  ×
                </button>
              )}
            </div>
          )}
          <ColumnIdsContext.Provider value={ids}>
            <ul className="max-h-[50vh] p-1 overflow-auto">
              {paddedColumnRanks.map((position, index) => (
                <DataTableColumnRankContext.Provider
                  value={position}
                  key={index}
                >
                  <DataTableColumnFilterContext.Provider
                    value={columnFilter}
                    key={index}
                  >
                    {childrenArray[position]}
                  </DataTableColumnFilterContext.Provider>
                </DataTableColumnRankContext.Provider>
              ))}
            </ul>
          </ColumnIdsContext.Provider>
          <div className="text-center py-1">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                if (preferences) preferences.reset();
                else {
                  setColumnRanks(undefined);
                  setHiddenColumns(defaultHiddenColumns);
                }
              }}
            >
              {translate("ra.action.reset", { _: "Réinitialiser" })}
            </Button>
          </div>
        </>
      )}
    </div>,
    container,
  );
};

interface ColumnsSelectorProps {
  children?: React.ReactNode;
}

export const ColumnsSelectorItem = <
  RecordType extends RaRecord<Identifier> = RaRecord<Identifier>,
>({
  source,
  label,
}: ColumnsSelectorItemProps<RecordType>) => {
  const resource = useResourceContext();
  const preferences = useColumnPreferences();
  const allIds = useContext(ColumnIdsContext);
  const { storeKey, defaultHiddenColumns } = useDataTableStoreContext();
  const [hiddenColumns, setHiddenColumns] = useStore<string[]>(
    storeKey,
    defaultHiddenColumns,
  );
  const columnRank = useDataTableColumnRankContext();
  const [columnRanks, setColumnRanks] = useStore<number[]>(
    `${storeKey}_columnRanks`,
  );
  const columnFilter = useDataTableColumnFilterContext();
  const translateLabel = useTranslateLabel();
  if (!source && !label) return null;
  const fieldLabel = translateLabel({
    label: typeof label === "string" ? label : undefined,
    resource,
    source,
  }) as string;
  const isColumnHidden = (
    preferences?.settings.hidden ?? hiddenColumns
  ).includes(source!);
  const isColumnFiltered = fieldLabelMatchesFilter(fieldLabel, columnFilter);

  const handleMove = (
    index1: number | string,
    index2: number | string | null,
  ) => {
    if (preferences) {
      const from = Number(index1);
      const to = index2 === null ? -1 : Number(index2);
      if (!Number.isInteger(to) || !allIds[from] || !allIds[to]) return;
      preferences.update((current) => {
        const order = orderedColumnIds(allIds, current.order);
        const fromPos = order.indexOf(allIds[from]);
        const toPos = order.indexOf(allIds[to]);
        if (fromPos < 0 || toPos < 0) return current;
        order.splice(toPos, 0, ...order.splice(fromPos, 1));
        return { ...current, order };
      });
      return;
    }
    const colRanks = !columnRanks
      ? padRanks([], Math.max(Number(index1), Number(index2 || 0)) + 1)
      : Math.max(Number(index1), Number(index2 || 0)) > columnRanks.length - 1
        ? padRanks(
            columnRanks,
            Math.max(Number(index1), Number(index2 || 0)) + 1,
          )
        : columnRanks;
    const index1Pos = colRanks.findIndex((index) => index == Number(index1));
    const index2Pos = colRanks.findIndex((index) => index == Number(index2));
    if (index1Pos === -1 || index2Pos === -1) {
      return;
    }
    let newColumnRanks;
    if (index1Pos > index2Pos) {
      newColumnRanks = [
        ...colRanks.slice(0, index2Pos),
        colRanks[index1Pos],
        ...colRanks.slice(index2Pos, index1Pos),
        ...colRanks.slice(index1Pos + 1),
      ];
    } else {
      newColumnRanks = [
        ...colRanks.slice(0, index1Pos),
        ...colRanks.slice(index1Pos + 1, index2Pos + 1),
        colRanks[index1Pos],
        ...colRanks.slice(index2Pos + 1),
      ];
    }
    setColumnRanks(newColumnRanks);
  };

  return isColumnFiltered ? (
    <FieldToggle
      key={columnRank}
      source={source!}
      label={fieldLabel}
      index={String(columnRank)}
      selected={!isColumnHidden}
      onToggle={() =>
        preferences
          ? preferences.update((current) => ({
              ...current,
              hidden: isColumnHidden
                ? current.hidden.filter((column) => column !== source!)
                : [...current.hidden, source!],
            }))
          : isColumnHidden
            ? setHiddenColumns(
                hiddenColumns.filter((column) => column !== source!),
              )
            : setHiddenColumns([...hiddenColumns, source!])
      }
      onMove={handleMove}
    />
  ) : null;
};

// this is the same interface as DataTableColumnProps
// but we copied it here to avoid circular dependencies with data-table
export interface ColumnsSelectorItemProps<
  RecordType extends RaRecord<Identifier> = RaRecord<Identifier>,
> {
  className?: string;
  cellClassName?: string;
  headerClassName?: string;
  conditionalClassName?: (record: RecordType) => string | false | undefined;
  children?: ReactNode;
  render?: (record: RecordType) => React.ReactNode;
  field?: React.ElementType;
  source?: NoInfer<HintedString<ExtractRecordPaths<RecordType>>>;
  label?: React.ReactNode;
  disableSort?: boolean;
  sortByOrder?: SortPayload["order"];
}
// Function to help with column ranking
const padRanks = (ranks: number[], length: number) =>
  ranks.concat(
    Array.from({ length: length - ranks.length }, (_, i) => ranks.length + i),
  );

const fieldLabelMatchesFilter = (fieldLabel: string, columnFilter?: string) =>
  columnFilter
    ? diacritic
        .clean(fieldLabel)
        .toLowerCase()
        .includes(diacritic.clean(columnFilter).toLowerCase())
    : true;

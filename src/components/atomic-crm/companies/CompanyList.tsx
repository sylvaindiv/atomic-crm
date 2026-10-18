import {
  FilterLiveForm,
  useGetIdentity,
  useListContext,
  useTranslate,
} from "ra-core";
import { CreateButton } from "@/components/admin/create-button";
import { ColumnsButton } from "@/components/admin/columns-button";
import { List } from "@/components/admin/list";
import { ListPagination } from "@/components/admin/list-pagination";
import { SortButton } from "@/components/admin/sort-button";
import { SearchInput } from "@/components/admin/search-input";
import { Card } from "@/components/ui/card";

import { TopToolbar } from "../layout/TopToolbar";
import { ColumnPreferencesProvider } from "../misc/ColumnPreferencesProvider";
import { AssignedToMeInput } from "../misc/AssignedToMeInput";
import { CompanyEmpty } from "./CompanyEmpty";
import { CompanyTable } from "./table/CompanyTable";

export const CompanyList = () => {
  const { identity } = useGetIdentity();
  if (!identity) return null;
  return (
    <ColumnPreferencesProvider
      key={identity.id}
      userId={identity.id}
      resource="companies"
    >
      <div className="pb-20 sm:pb-0">
        <List
          title={false}
          perPage={25}
          sort={{ field: "name", order: "ASC" }}
          disableSyncWithLocation
          storeKey="companies-search"
          actions={false}
          pagination={<ListPagination />}
        >
          <CompanyListLayout />
        </List>
      </div>
    </ColumnPreferencesProvider>
  );
};

const CompanyListLayout = () => {
  const { data, isPending, filterValues } = useListContext();
  const hasFilters = filterValues && Object.keys(filterValues).length > 0;

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <CompanyListActions />
      {!isPending &&
        (!data?.length && !hasFilters ? (
          <CompanyEmpty />
        ) : (
          <Card className="py-0">
            <CompanyTable />
          </Card>
        ))}
    </div>
  );
};

const CompanyListActions = () => {
  const translate = useTranslate();
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="w-52 max-w-full">
        <FilterLiveForm>
          <SearchInput source="q" />
        </FilterLiveForm>
      </div>
      <AssignedToMeInput />
      <TopToolbar className="ml-auto min-w-0 max-w-full overflow-x-auto">
        <SortButton fields={["name", "created_at", "nb_contacts"]} />
        <ColumnsButton />
        <CreateButton
          label={translate("resources.companies.action.new", {
            _: "New Club",
          })}
        />
      </TopToolbar>
    </div>
  );
};

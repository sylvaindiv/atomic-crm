import {
  withLifecycleCallbacks,
  type DataProvider,
  type GetListParams,
  type Identifier,
  type ResourceCallbacks,
} from "ra-core";
import type {
  Contact,
  ContactNote,
  RAFile,
  Sale,
  SalesFormData,
  SignUpData,
} from "../../types";
import type { ConfigurationContextValue } from "../../root/ConfigurationContext";
import { getActivityLog } from "../commons/activity";
import { mergeCompanies as mergeCompaniesCommon } from "../commons/mergeCompanies";
import { mergeContacts as mergeContactsCommon } from "../commons/mergeContacts";
import { getIsInitialized, setAuthSession } from "./authProvider";
import {
  apiFetch,
  apiPatch,
  apiPost,
  baseDataProvider,
} from "./internal/httpClient";
import type { ColumnSettings } from "@/components/admin/column-preferences-context";
import type { ColumnResource } from "../../misc/ColumnPreferencesProvider";

// --- Attachment / image handling -------------------------------------------
// Supabase Storage is replaced by base64-in-database storage: uploaded files
// are inlined as data URLs (single-user personal deployment, no object store).

const fileToBase64 = (file: Blob): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

const processRAFile = async (fi: RAFile): Promise<RAFile> => {
  if (fi?.rawFile instanceof File) {
    const src = await fileToBase64(fi.rawFile);
    return { ...fi, src, type: fi.rawFile.type };
  }
  return fi;
};

const processConfigLogo = async (logo: any): Promise<string> => {
  if (typeof logo === "string") return logo;
  if (logo?.rawFile instanceof File) {
    return await fileToBase64(logo.rawFile);
  }
  return logo?.src ?? "";
};

const processCompanyLogo = async (params: any) => {
  const logo = params.data.logo;
  if (logo?.rawFile instanceof File) {
    const src = await fileToBase64(logo.rawFile);
    return {
      ...params,
      data: {
        ...params.data,
        logo: { src, title: logo.title, type: logo.rawFile.type },
      },
    };
  }
  return params;
};

// --- Data provider ----------------------------------------------------------

const getDataProviderWithCustomMethods = () => {
  return {
    ...baseDataProvider,
    async getColumnPreferences(
      resource: ColumnResource,
    ): Promise<ColumnSettings | null> {
      const { settings } = await apiFetch<{ settings: ColumnSettings | null }>(
        `preferences/columns/${resource}`,
      );
      return settings;
    },
    async saveColumnPreferences(
      resource: ColumnResource,
      settings: ColumnSettings,
    ): Promise<void> {
      await apiFetch(`preferences/columns/${resource}`, {
        method: "PUT",
        body: JSON.stringify(settings),
      });
    },
    async getList(resource: string, params: GetListParams) {
      if (resource === "companies") {
        return baseDataProvider.getList("companies_summary", params);
      }
      if (resource === "contacts") {
        return baseDataProvider.getList("contacts_summary", params);
      }
      if (resource === "activity_log") {
        const { filter = {}, pagination } = params;
        const all = await getActivityLog(
          baseDataProvider,
          filter.company_id,
          filter.sales_id,
        );
        const { page = 1, perPage = 25 } = pagination ?? {};
        const start = (page - 1) * perPage;
        return {
          data: all.slice(start, start + perPage) as any[],
          total: all.length,
        };
      }
      return baseDataProvider.getList(resource, params);
    },
    async getOne(resource: string, params: any) {
      if (resource === "companies") {
        return baseDataProvider.getOne("companies_summary", params);
      }
      if (resource === "contacts") {
        return baseDataProvider.getOne("contacts_summary", params);
      }
      return baseDataProvider.getOne(resource, params);
    },

    async signUp(
      _data: SignUpData,
    ): Promise<{ id: string; email: string; password: string }> {
      throw new Error("L’inscription publique est désactivée.");
    },
    async salesCreate(body: SalesFormData) {
      const avatar = body.avatar
        ? await processRAFile(
            typeof body.avatar === "string"
              ? ({ src: body.avatar } as RAFile)
              : (body.avatar as RAFile),
          )
        : undefined;
      const { user } = await apiPost<{ user: Sale }>("auth/users", {
        email: body.email,
        first_name: body.first_name,
        last_name: body.last_name,
        password: body.password,
        disabled: body.disabled ?? false,
        avatar,
      });
      return user;
    },
    async salesUpdate(
      id: Identifier,
      data: Partial<Omit<SalesFormData, "password">>,
    ) {
      const { avatar, ...rest } = data as any;
      const patch: Record<string, unknown> = { ...rest };
      if (avatar) {
        patch.avatar = await processRAFile(
          typeof avatar === "string" ? ({ src: avatar } as RAFile) : avatar,
        );
      }
      const { user } = await apiPatch<{ user: Sale }>(
        `auth/users/${id}`,
        patch,
      );
      return user;
    },
    async updatePassword(
      _id: Identifier,
      data: { currentPassword: string; newPassword: string },
    ) {
      const nextSession = await apiPost<{
        user: { id: number; first_name: string; last_name: string };
        must_change_password: boolean;
      }>("auth/password", data);
      setAuthSession(nextSession);
      return true;
    },
    async resetPassword(id: Identifier, data: { newPassword: string }) {
      await apiPost(`auth/users/${id}/password`, data);
      return true;
    },
    async isInitialized() {
      return getIsInitialized();
    },
    async mergeContacts(sourceId: Identifier, targetId: Identifier) {
      return mergeContactsCommon(sourceId, targetId, baseDataProvider);
    },
    async mergeCompanies(sourceId: Identifier, targetId: Identifier) {
      return mergeCompaniesCommon(sourceId, targetId, baseDataProvider);
    },
    async getConfiguration(): Promise<ConfigurationContextValue> {
      const { data } = await baseDataProvider.getOne("configuration", {
        id: 1,
      });
      return (data?.config as ConfigurationContextValue) ?? {};
    },
    async updateConfiguration(
      config: ConfigurationContextValue,
    ): Promise<ConfigurationContextValue> {
      const { data } = await baseDataProvider.update("configuration", {
        id: 1,
        data: { config },
        previousData: { id: 1 },
      });
      return data.config as ConfigurationContextValue;
    },
  } satisfies DataProvider;
};

export type CrmDataProvider = ReturnType<
  typeof getDataProviderWithCustomMethods
>;

const lifeCycleCallbacks: ResourceCallbacks[] = [
  {
    resource: "configuration",
    beforeUpdate: async (params) => {
      const config = params.data.config;
      if (config) {
        config.lightModeLogo = await processConfigLogo(config.lightModeLogo);
        config.darkModeLogo = await processConfigLogo(config.darkModeLogo);
      }
      return params;
    },
  },
  {
    resource: "contact_notes",
    beforeSave: async (data: ContactNote, _, __) => {
      if (data.attachments) {
        data.attachments = await Promise.all(
          data.attachments.map((fi) => processRAFile(fi)),
        );
      }
      return data;
    },
  },
  {
    resource: "sales",
    beforeSave: async (data: Sale, _, __) => {
      if (data.avatar) {
        data.avatar = await processRAFile(data.avatar as RAFile);
      }
      return data;
    },
  },
  {
    resource: "contacts",
    beforeGetList: async (params) => {
      return applyFullTextSearch([
        "first_name",
        "last_name",
        "company_name",
        "title",
        "email",
        "phone",
        "background",
      ])(params);
    },
    beforeSave: async (data: Contact, _, __) => {
      if (data.avatar) {
        data.avatar = await processRAFile(data.avatar as RAFile);
      }
      return data;
    },
  },
  {
    resource: "companies",
    beforeGetList: async (params) => {
      return applyFullTextSearch([
        "name",
        "phone_number",
        "website",
        "zipcode",
        "city",
        "state_abbr",
      ])(params);
    },
    beforeCreate: async (params) => {
      const createParams = await processCompanyLogo(params);
      return {
        ...createParams,
        data: {
          created_at: new Date().toISOString(),
          ...createParams.data,
        },
      };
    },
    beforeUpdate: async (params) => {
      return await processCompanyLogo(params);
    },
  },
  {
    resource: "contacts_summary",
    beforeGetList: async (params) => {
      return applyFullTextSearch(["first_name", "last_name"])(params);
    },
  },
];

export const getDataProvider = (): CrmDataProvider => {
  return withLifecycleCallbacks(
    getDataProviderWithCustomMethods(),
    lifeCycleCallbacks,
  ) as CrmDataProvider;
};

const applyFullTextSearch = (columns: string[]) => (params: GetListParams) => {
  if (!params.filter?.q) {
    return params;
  }
  const { q, ...filter } = params.filter;
  return {
    ...params,
    filter: {
      ...filter,
      "@or": columns.reduce((acc, column) => {
        if (column === "email")
          return {
            ...acc,
            [`email_fts@ilike`]: q,
          };
        if (column === "phone")
          return {
            ...acc,
            [`phone_fts@ilike`]: q,
          };
        else
          return {
            ...acc,
            [`${column}@ilike`]: q,
          };
      }, {}),
    },
  };
};

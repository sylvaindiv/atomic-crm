import { withClubMemberships } from "./internal/withClubMemberships";
import {
  withLifecycleCallbacks,
  type CreateParams,
  type DataProvider,
  type Identifier,
  type ResourceCallbacks,
  type UpdateParams,
} from "ra-core";
import fakeRestDataProvider from "ra-data-fakerest";

import type {
  Company,
  Contact,
  ContactNote,
  Sale,
  SalesFormData,
  SignUpData,
  Task,
} from "../../types";
import type { ConfigurationContextValue } from "../../root/ConfigurationContext";
import { getActivityLog } from "../commons/activity";
import { getCompanyAvatar } from "../commons/getCompanyAvatar";
import { getContactAvatar } from "../commons/getContactAvatar";
import { mergeCompanies } from "../commons/mergeCompanies";
import { mergeContacts } from "../commons/mergeContacts";
import { isValidDueDate, validateNextAction } from "../../notes/noteModel";
import type { CrmDataProvider } from "../types";
import type { ColumnSettings } from "@/components/admin/column-preferences-context";
import type { ColumnResource } from "../../misc/ColumnPreferencesProvider";
import {
  authProvider as defaultAuthProvider,
  USER_STORAGE_KEY,
} from "./authProvider";
import generateData from "./dataGenerator";
import type { Db } from "./dataGenerator/types";
import { withSupabaseFilterAdapter } from "./internal/supabaseAdapter";

const TASK_MARKED_AS_DONE = "TASK_MARKED_AS_DONE";
const TASK_MARKED_AS_UNDONE = "TASK_MARKED_AS_UNDONE";
const TASK_DONE_NOT_CHANGED = "TASK_DONE_NOT_CHANGED";

const processCompanyLogo = async (params: any) => {
  let logo = params.data.logo;

  if (typeof logo !== "object" || logo === null || !logo.src) {
    logo = await getCompanyAvatar(params.data);
  } else if (logo.rawFile instanceof File) {
    const base64Logo = await convertFileToBase64(logo);
    logo = { src: base64Logo, title: logo.title };
  }

  return {
    ...params,
    data: {
      ...params.data,
      logo,
    },
  };
};

async function processContactAvatar(
  params: UpdateParams<Contact>,
): Promise<UpdateParams<Contact>>;

async function processContactAvatar(
  params: CreateParams<Contact>,
): Promise<CreateParams<Contact>>;

async function processContactAvatar(
  params: CreateParams<Contact> | UpdateParams<Contact>,
): Promise<CreateParams<Contact> | UpdateParams<Contact>> {
  const { data } = params;
  if (data.avatar?.src || !data.email_jsonb || !data.email_jsonb.length) {
    return params;
  }
  const avatarUrl = await getContactAvatar(data);

  // Clone the data and modify the clone
  const newData = { ...data, avatar: { src: avatarUrl || undefined } };

  return { ...params, data: newData };
}

async function fetchAndUpdateCompanyData(
  params: UpdateParams<Contact>,
  dataProvider: DataProvider,
): Promise<UpdateParams<Contact>>;

async function fetchAndUpdateCompanyData(
  params: CreateParams<Contact>,
  dataProvider: DataProvider,
): Promise<CreateParams<Contact>>;

async function fetchAndUpdateCompanyData(
  params: CreateParams<Contact> | UpdateParams<Contact>,
  dataProvider: DataProvider,
): Promise<CreateParams<Contact> | UpdateParams<Contact>> {
  const { data } = params;
  const newData = { ...data };

  if (!newData.company_id) {
    return params;
  }

  const { data: company } = await dataProvider.getOne("companies", {
    id: newData.company_id,
  });

  if (!company) {
    return params;
  }

  newData.company_name = company.name;
  return { ...params, data: newData };
}

export interface CreateFakeRestDataProviderOptions {
  db?: Db;
  latency?: number;
  authProvider?: Pick<typeof defaultAuthProvider, "getIdentity">;
  silent?: boolean;
}

const processConfigLogo = async (logo: any): Promise<string> => {
  if (typeof logo === "string") return logo;
  if (logo?.rawFile instanceof File) {
    return (await convertFileToBase64(logo)) as string;
  }
  return logo?.src ?? "";
};

const preserveAttachmentMimeType = <
  NoteType extends { attachments?: Array<{ rawFile?: File; type?: string }> },
>(
  note: NoteType,
): NoteType => ({
  ...note,
  attachments: (note.attachments ?? []).map((attachment) => ({
    ...attachment,
    type: attachment.type ?? attachment.rawFile?.type,
  })),
});

const validateChecklistWrite = (resource: string, data: any) => {
  if (resource === "contacts" && "client_checklist" in (data ?? {})) {
    const ids = data.client_checklist;
    if (
      !Array.isArray(ids) ||
      ids.some((id: unknown) => typeof id !== "string" || !id.trim()) ||
      new Set(ids).size !== ids.length
    ) {
      throw new Error("client_checklist must be a unique array of IDs");
    }
  }
  if (
    resource === "configuration" &&
    data?.config?.clientChecklist !== undefined
  ) {
    const items = data.config.clientChecklist;
    if (
      !Array.isArray(items) ||
      items.some(
        (item: any) =>
          !item ||
          typeof item.value !== "string" ||
          !item.value.trim() ||
          typeof item.label !== "string" ||
          !item.label.trim(),
      ) ||
      new Set(items.map((item: any) => item.value)).size !== items.length
    ) {
      throw new Error("clientChecklist must contain unique IDs and labels");
    }
  }
};

export const createDataProvider = ({
  db = generateData(),
  latency = 300,
  authProvider,
  silent = false,
}: CreateFakeRestDataProviderOptions = {}): CrmDataProvider => {
  db.contacts.forEach((contact) => {
    contact.contact_type ??= "referee";
    contact.company_ids ??=
      contact.company_id == null ? [] : [contact.company_id];
  });
  const baseDataProvider = withClubMemberships(
    fakeRestDataProvider(db, !silent, latency),
  );
  let taskUpdateType = TASK_DONE_NOT_CHANGED;
  const getIdentity = async () =>
    authProvider?.getIdentity?.() ?? defaultAuthProvider.getIdentity?.();

  const dataProviderWithCustomMethod: CrmDataProvider = {
    ...baseDataProvider,
    async getColumnPreferences(
      resource: ColumnResource,
    ): Promise<ColumnSettings | null> {
      const user = await getIdentity();
      const saved = localStorage.getItem(
        `column-preferences:${user?.id}:${resource}`,
      );
      return saved ? (JSON.parse(saved) as ColumnSettings) : null;
    },
    async saveColumnPreferences(
      resource: ColumnResource,
      settings: ColumnSettings,
    ): Promise<void> {
      const user = await getIdentity();
      localStorage.setItem(
        `column-preferences:${user?.id}:${resource}`,
        JSON.stringify(settings),
      );
    },
    async getList(resource: string, params: any) {
      if (
        (resource === "tasks" || resource === "contact_notes") &&
        params.filter?.contact_type
      ) {
        const { contact_type, ...filter } = params.filter;
        const ids = db.contacts
          .filter((contact) => contact.contact_type === contact_type)
          .map((contact) => contact.id);
        return baseDataProvider.getList(resource, {
          ...params,
          filter: { ...filter, contact_id_eq_any: ids },
        });
      }
      if (resource === "activity_log") {
        const { filter = {}, pagination } = params;
        const all = await getActivityLog(
          withSupabaseFilterAdapter(dataProviderWithCustomMethod),
          filter.company_id,
          filter.sales_id,
        );
        const { page, perPage } = pagination;
        const start = (page - 1) * perPage;
        return { data: all.slice(start, start + perPage), total: all.length };
      }
      return baseDataProvider.getList(resource, params);
    },
    signUp: async ({
      email,
      password,
      first_name,
      last_name,
    }: SignUpData): Promise<{
      id: string;
      email: string;
      password: string;
    }> => {
      const user = await baseDataProvider.create("sales", {
        data: {
          email,
          first_name,
          last_name,
        },
      });

      return {
        ...user.data,
        password,
      };
    },
    salesCreate: async ({
      password,
      ...data
    }: SalesFormData): Promise<Sale> => {
      const response = await dataProvider.create("sales", {
        data: {
          ...data,
          password: password ?? "new_password",
        },
      });

      return response.data;
    },
    salesUpdate: async (
      id: Identifier,
      data: Partial<Omit<SalesFormData, "password">>,
    ): Promise<Sale> => {
      const { data: previousData } = await dataProvider.getOne<Sale>("sales", {
        id,
      });

      if (!previousData) {
        throw new Error("User not found");
      }

      const { data: sale } = await dataProvider.update<Sale>("sales", {
        id,
        data,
        previousData,
      });
      return { ...sale, user_id: sale.id.toString() };
    },
    isInitialized: async (): Promise<boolean> => {
      const sales = await dataProvider.getList<Sale>("sales", {
        filter: {},
        pagination: { page: 1, perPage: 1 },
        sort: { field: "id", order: "ASC" },
      });
      if (sales.data.length === 0) {
        return false;
      }
      return true;
    },
    updatePassword: async (
      id: Identifier,
      { newPassword }: { currentPassword: string; newPassword: string },
    ): Promise<true> => {
      await dataProvider.resetPassword(id, { newPassword });
      return true;
    },
    resetPassword: async (
      id: Identifier,
      { newPassword }: { newPassword: string },
    ): Promise<true> => {
      const { data: previousData } = await dataProvider.getOne<Sale>("sales", {
        id,
      });
      if (!previousData) throw new Error("User not found");
      await dataProvider.update("sales", {
        id,
        data: { password: newPassword },
        previousData,
      });
      return true;
    },
    mergeContacts: async (sourceId: Identifier, targetId: Identifier) => {
      return mergeContacts(sourceId, targetId, baseDataProvider);
    },
    mergeCompanies: async (sourceId: Identifier, targetId: Identifier) => {
      return mergeCompanies(sourceId, targetId, dataProvider);
    },
    getConfiguration: async (): Promise<ConfigurationContextValue> => {
      const { data } = await baseDataProvider.getOne("configuration", {
        id: 1,
      });
      return (data?.config as ConfigurationContextValue) ?? {};
    },
    updateConfiguration: async (
      config: ConfigurationContextValue,
    ): Promise<ConfigurationContextValue> => {
      const { data: prev } = await baseDataProvider.getOne("configuration", {
        id: 1,
      });
      await baseDataProvider.update("configuration", {
        id: 1,
        data: { config },
        previousData: prev,
      });
      return config;
    },
  };

  const lifecycleDataProvider = withLifecycleCallbacks(
    withSupabaseFilterAdapter(dataProviderWithCustomMethod),
    [
      {
        resource: "configuration",
        beforeUpdate: async (params) => {
          const config = params.data.config;
          if (config) {
            config.lightModeLogo = await processConfigLogo(
              config.lightModeLogo,
            );
            config.darkModeLogo = await processConfigLogo(config.darkModeLogo);
          }
          return params;
        },
      },
      {
        resource: "sales",
        beforeCreate: async (params) => {
          const { data } = params;
          // If administrator role is not set, we simply set it to false
          if (data.administrator == null) {
            data.administrator = false;
          }
          return params;
        },
        afterSave: async (data) => {
          // Since the current user is stored in localStorage in fakerest authProvider
          // we need to update it to keep information up to date in the UI
          const currentUser = await getIdentity();
          if (currentUser?.id === data.id) {
            localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(data));
          }
          return data;
        },
        beforeDelete: async (params) => {
          if (params.meta?.identity?.id == null) {
            throw new Error("Identity MUST be set in meta");
          }

          const newSaleId = params.meta.identity.id as Identifier;

          const [companies, contacts, contactNotes] = await Promise.all([
            dataProvider.getList("companies", {
              filter: { sales_id: params.id },
              pagination: {
                page: 1,
                perPage: 10_000,
              },
              sort: { field: "id", order: "ASC" },
            }),
            dataProvider.getList("contacts", {
              filter: { sales_id: params.id },
              pagination: {
                page: 1,
                perPage: 10_000,
              },
              sort: { field: "id", order: "ASC" },
            }),
            dataProvider.getList("contact_notes", {
              filter: { sales_id: params.id },
              pagination: {
                page: 1,
                perPage: 10_000,
              },
              sort: { field: "id", order: "ASC" },
            }),
          ]);

          await Promise.all([
            dataProvider.updateMany("companies", {
              ids: companies.data.map((company) => company.id),
              data: {
                sales_id: newSaleId,
              },
            }),
            dataProvider.updateMany("contacts", {
              ids: contacts.data.map((company) => company.id),
              data: {
                sales_id: newSaleId,
              },
            }),
            dataProvider.updateMany("contact_notes", {
              ids: contactNotes.data.map((company) => company.id),
              data: {
                sales_id: newSaleId,
              },
            }),
          ]);

          return params;
        },
      } satisfies ResourceCallbacks<Sale>,
      {
        resource: "contacts",
        beforeCreate: async (createParams, dataProvider) => {
          const params = {
            ...createParams,
            data: {
              ...createParams.data,
              first_seen:
                createParams.data.first_seen ?? new Date().toISOString(),
              last_seen:
                createParams.data.last_seen ?? new Date().toISOString(),
            },
          };
          const newParams = await processContactAvatar(params);
          return fetchAndUpdateCompanyData(newParams, dataProvider);
        },
        beforeUpdate: async (params) => {
          const newParams = await processContactAvatar(params);
          return fetchAndUpdateCompanyData(newParams, dataProvider);
        },
      } satisfies ResourceCallbacks<Contact>,
      {
        resource: "tasks",
        afterCreate: async (result, dataProvider) => {
          // update the task count in the related contact
          const { contact_id } = result.data;
          const { data: contact } = await dataProvider.getOne("contacts", {
            id: contact_id,
          });
          await dataProvider.update("contacts", {
            id: contact_id,
            data: {
              nb_tasks: (contact.nb_tasks ?? 0) + 1,
            },
            previousData: contact,
          });
          return result;
        },
        beforeUpdate: async (params) => {
          const { data, previousData } = params;
          if (previousData.done_date !== data.done_date) {
            taskUpdateType = data.done_date
              ? TASK_MARKED_AS_DONE
              : TASK_MARKED_AS_UNDONE;
          } else {
            taskUpdateType = TASK_DONE_NOT_CHANGED;
          }
          return params;
        },
        afterUpdate: async (result, dataProvider) => {
          // update the contact: if the task is done, decrement the nb tasks, otherwise increment it
          const { contact_id } = result.data;
          const { data: contact } = await dataProvider.getOne("contacts", {
            id: contact_id,
          });
          if (taskUpdateType !== TASK_DONE_NOT_CHANGED) {
            await dataProvider.update("contacts", {
              id: contact_id,
              data: {
                nb_tasks:
                  taskUpdateType === TASK_MARKED_AS_DONE
                    ? (contact.nb_tasks ?? 0) - 1
                    : (contact.nb_tasks ?? 0) + 1,
              },
              previousData: contact,
            });
          }
          return result;
        },
        afterDelete: async (result, dataProvider) => {
          // update the task count in the related contact
          const { contact_id } = result.data;
          const { data: contact } = await dataProvider.getOne("contacts", {
            id: contact_id,
          });
          await dataProvider.update("contacts", {
            id: contact_id,
            data: {
              nb_tasks: (contact.nb_tasks ?? 0) - 1,
            },
            previousData: contact,
          });
          return result;
        },
      } satisfies ResourceCallbacks<Task>,
      {
        resource: "companies",
        beforeCreate: async (params) => {
          const createParams = await processCompanyLogo(params);

          return {
            ...createParams,
            data: {
              ...createParams.data,
              created_at: new Date().toISOString(),
            },
          };
        },
        beforeUpdate: async (params) => {
          // Partial updates (e.g. the status selector sending only
          // `{ status }`) must not touch the logo: `processCompanyLogo`
          // treats a missing `logo` key as "no logo", falls back to
          // `getCompanyAvatar`, and -- without a website in the partial
          // payload -- erases the existing logo. Only run it when the
          // update actually carries a `logo` key, mirroring the early
          // return `processContactAvatar` uses for the same reason.
          return "logo" in params.data
            ? await processCompanyLogo(params)
            : params;
        },
      } satisfies ResourceCallbacks<Company>,
      {
        resource: "contact_notes",
        beforeSave: async (params) => preserveAttachmentMimeType(params),
      } satisfies ResourceCallbacks<ContactNote>,
    ],
  ) as CrmDataProvider;

  const create = lifecycleDataProvider.create.bind(lifecycleDataProvider);
  const update = lifecycleDataProvider.update.bind(lifecycleDataProvider);
  const dataProvider: CrmDataProvider = {
    ...lifecycleDataProvider,
    async create(resource, params) {
      validateChecklistWrite(resource, params.data);
      if (
        !params.data ||
        !Object.prototype.hasOwnProperty.call(params.data, "next_action")
      ) {
        return create(resource, params);
      }
      if (resource !== "contact_notes") {
        throw new Error(
          "next_action is only supported when creating a contact note",
        );
      }

      const { next_action, ...noteData } = params.data as typeof params.data & {
        next_action: unknown;
      };
      if (!validateNextAction(next_action)) {
        throw new Error("next_action is invalid");
      }
      if (
        noteData.contact_id == null ||
        (!(typeof noteData.text === "string" && noteData.text.trim()) &&
          !(
            Array.isArray(noteData.attachments) &&
            noteData.attachments.length > 0
          ))
      ) {
        throw new Error("A note requires a contact and text or an attachment");
      }

      const { data: contact } = await lifecycleDataProvider.getOne<Contact>(
        "contacts",
        { id: noteData.contact_id },
      );
      if (next_action.mode === "existing") {
        const { data: task } = await lifecycleDataProvider.getOne<Task>(
          "tasks",
          { id: next_action.task_id },
        );
        if (
          String(task.contact_id) !== String(contact.id) ||
          task.done_date != null ||
          typeof task.text !== "string" ||
          !task.text.trim() ||
          typeof task.due_date !== "string" ||
          !isValidDueDate(task.due_date)
        ) {
          throw new Error(
            "Selected task is not an open valid task for this contact",
          );
        }
      }

      const listParams = {
        filter: {},
        pagination: { page: 1, perPage: 10_000 },
        sort: { field: "id", order: "ASC" as const },
      };
      const [{ data: notesBefore }, { data: tasksBefore }] = await Promise.all([
        lifecycleDataProvider.getList<ContactNote>("contact_notes", listParams),
        lifecycleDataProvider.getList<Task>("tasks", listParams),
      ]);
      const originalNoteIds = new Set(notesBefore.map((note) => note.id));
      const originalTaskIds = new Set(tasksBefore.map((task) => task.id));
      try {
        const result = await create("contact_notes", {
          ...params,
          data: noteData,
        });
        if (next_action.mode === "create") {
          await create("tasks", {
            data: {
              contact_id: contact.id,
              type: "none",
              text: next_action.text.trim(),
              due_date: next_action.due_date,
              done_date: null,
              sales_id: noteData.sales_id ?? null,
            },
          });
        }

        await dataProvider.update("contacts", {
          id: contact.id,
          data: {
            last_seen: new Date().toISOString(),
            ...(noteData.status !== undefined
              ? { status: noteData.status }
              : {}),
          },
          previousData: contact,
        });
        return result;
      } catch (error) {
        const [{ data: notesAfter }, { data: tasksAfter }] = await Promise.all([
          lifecycleDataProvider.getList<ContactNote>(
            "contact_notes",
            listParams,
          ),
          lifecycleDataProvider.getList<Task>("tasks", listParams),
        ]);
        await Promise.allSettled([
          ...tasksAfter
            .filter((task) => !originalTaskIds.has(task.id))
            .map((task) =>
              baseDataProvider.delete("tasks", {
                id: task.id,
                previousData: task,
              }),
            ),
          ...notesAfter
            .filter((note) => !originalNoteIds.has(note.id))
            .map((note) =>
              baseDataProvider.delete("contact_notes", {
                id: note.id,
                previousData: note,
              }),
            ),
        ]);
        try {
          await baseDataProvider.update("contacts", {
            id: contact.id,
            data: contact,
            previousData: contact,
          });
        } catch {
          // Preserve the original write error if compensation also fails.
        }
        throw error;
      }
    },
    async update(resource, params) {
      validateChecklistWrite(resource, params.data);
      return update(resource, params);
    },
  };

  return dataProvider;
};

export const dataProvider = createDataProvider();

/**
 * Convert a `File` object returned by the upload input into a base 64 string.
 * That's not the most optimized way to store images in production, but it's
 * enough to illustrate the idea of dataprovider decoration.
 */
const convertFileToBase64 = (file: { rawFile: Blob }): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    // We know result is a string as we used readAsDataURL
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file.rawFile);
  });

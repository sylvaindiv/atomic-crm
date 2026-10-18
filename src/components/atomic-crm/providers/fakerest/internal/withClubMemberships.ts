import type { DataProvider, Identifier } from "ra-core";
import type { Contact } from "../../../types";

// FakeRest's tables are small in-memory demo data; recompute derived names/counts after writes.
export function withClubMemberships<T extends DataProvider>(provider: T): T {
  const all = (resource: string) =>
    provider.getList(resource, {
      pagination: { page: 1, perPage: Number.MAX_SAFE_INTEGER },
      sort: { field: "id", order: "ASC" },
      filter: {},
    });
  const validateTenup = async (
    resource: string,
    data: Record<string, unknown>,
    id?: Identifier,
  ) => {
    if (!["contacts", "companies"].includes(resource) || data.tenup_id == null)
      return;
    if (typeof data.tenup_id !== "string" || !data.tenup_id.trim())
      throw new Error("Invalid tenup_id");
    const { data: rows } = await all(resource);
    if (rows.some((row) => row.id !== id && row.tenup_id === data.tenup_id))
      throw new Error("Duplicate tenup_id");
  };
  const normalize = async (data: Partial<Contact>, previous?: Contact) => {
    const old =
      previous?.company_ids ??
      (previous?.company_id == null ? [] : [previous.company_id]);
    const legacyChange =
      previous &&
      "company_id" in data &&
      data.company_id !== previous.company_id &&
      JSON.stringify(data.company_ids) === JSON.stringify(previous.company_ids);
    const ids =
      "company_ids" in data && !legacyChange
        ? data.company_ids
        : "company_id" in data
          ? [
              ...new Set([
                ...(data.company_id == null ? [] : [data.company_id]),
                ...old.slice(1),
              ]),
            ]
          : old;
    if (
      !Array.isArray(ids) ||
      ids.some((id) => !Number.isSafeInteger(id) || Number(id) < 0) ||
      new Set(ids).size !== ids.length
    )
      throw new Error("Invalid company_ids");
    if (
      (data.contact_type ?? previous?.contact_type) === "partner" &&
      ids.length > 1
    )
      throw new Error("A partner can belong to only one club");
    const { data: companies } = await provider.getMany("companies", { ids });
    if (companies.length !== ids.length) throw new Error("Unknown club");
    return {
      ...data,
      company_ids: ids,
      company_id: ids[0] ?? null,
      company_name: ids
        .map((id) => companies.find((c) => c.id === id)?.name)
        .join(", "),
    };
  };
  const refresh = async () => {
    const [{ data: contacts }, { data: companies }] = await Promise.all([
      all("contacts"),
      all("companies"),
    ]);
    for (const company of companies)
      await provider.update("companies", {
        id: company.id,
        data: {
          nb_contacts: contacts.filter(
            (c) =>
              c.contact_type !== "partner" &&
              c.company_ids?.includes(company.id),
          ).length,
        },
        previousData: company,
      });
    for (const contact of contacts)
      await provider.update("contacts", {
        id: contact.id,
        data: {
          company_name: (contact.company_ids ?? [])
            .map((id: Identifier) => companies.find((c) => c.id === id)?.name)
            .filter(Boolean)
            .join(", "),
        },
        previousData: contact,
      });
  };
  const detach = async (ids: Identifier[]) => {
    const { data: contacts } = await all("contacts");
    for (const contact of contacts) {
      const clubs = (contact.company_ids ?? []).filter(
        (id: Identifier) => !ids.includes(id),
      );
      if (clubs.length !== contact.company_ids?.length)
        await provider.update("contacts", {
          id: contact.id,
          data: { company_ids: clubs, company_id: clubs[0] ?? null },
          previousData: contact,
        });
    }
  };
  return {
    ...provider,
    async create(resource, params) {
      await validateTenup(resource, params.data);
      const data =
        resource === "contacts" ? await normalize(params.data) : params.data;
      const result = await provider.create(resource, { ...params, data });
      if (resource === "contacts" || resource === "companies") await refresh();
      return result;
    },
    async update(resource, params) {
      await validateTenup(resource, params.data, params.id);
      const previous =
        resource === "contacts"
          ? (await provider.getOne<Contact>(resource, { id: params.id })).data
          : undefined;
      const data =
        resource === "contacts"
          ? await normalize(params.data, previous)
          : params.data;
      const result = await provider.update(resource, { ...params, data });
      if (resource === "contacts" || resource === "companies") await refresh();
      return result;
    },
    async updateMany(resource, params) {
      if (params.ids.length > 1 && params.data.tenup_id != null)
        throw new Error("Duplicate tenup_id");
      for (const id of params.ids)
        await validateTenup(resource, params.data, id);
      if (resource !== "contacts") return provider.updateMany(resource, params);
      const writes = await Promise.all(
        params.ids.map(async (id) => {
          const previousData = (
            await provider.getOne<Contact>(resource, { id })
          ).data;
          return {
            id,
            previousData,
            data: await normalize(params.data, previousData),
          };
        }),
      );
      for (const write of writes) await provider.update(resource, write);
      await refresh();
      return { data: params.ids };
    },
    async delete(resource, params) {
      if (resource === "companies") await detach([params.id]);
      const result = await provider.delete(resource, params);
      if (resource === "contacts" || resource === "companies") await refresh();
      return result;
    },
    async deleteMany(resource, params) {
      if (resource === "companies") await detach(params.ids);
      const result = await provider.deleteMany(resource, params);
      if (resource === "contacts" || resource === "companies") await refresh();
      return result;
    },
  } as T;
}

import type { Contact } from "../../types";
import type { CrmDataProvider } from "../types";

// Keep the resource boundary in the data provider: search, pagination, total,
// select-all and bulk exports all operate on an already filtered population.
export const withContactTypes = <T extends CrmDataProvider>(provider: T): T => {
  const typeFor = (resource: string) =>
    resource === "partners"
      ? "partner"
      : resource === "contacts" || resource === "contacts_summary"
        ? "referee"
        : null;
  const tableFor = (resource: string) =>
    resource === "partners" ? "contacts" : resource;
  const assertType = (resource: string, contact: Contact) => {
    if (typeFor(resource) && contact.contact_type !== typeFor(resource)) {
      throw new Error(`Contact #${contact.id} not found in ${resource}`);
    }
    return contact;
  };

  return {
    ...provider,
    getList(resource, params) {
      const contactType = typeFor(resource);
      return provider.getList(tableFor(resource), {
        ...params,
        filter: contactType
          ? { ...params.filter, contact_type: contactType }
          : params.filter,
      });
    },
    async getOne(resource, params) {
      const result = await provider.getOne(tableFor(resource), params);
      if (resource === "partners") assertType(resource, result.data as Contact);
      return result;
    },
    async getMany(resource, params) {
      const result = await provider.getMany(tableFor(resource), params);
      return resource === "partners"
        ? {
            ...result,
            data: result.data.filter(
              (record) => (record as Contact).contact_type === "partner",
            ),
          }
        : result;
    },
    getManyReference(resource, params) {
      const contactType = typeFor(resource);
      return provider.getManyReference(tableFor(resource), {
        ...params,
        filter: contactType
          ? { ...params.filter, contact_type: contactType }
          : params.filter,
      });
    },
    create(resource, params) {
      const contactType = typeFor(resource);
      return provider.create(tableFor(resource), {
        ...params,
        data: contactType
          ? { ...params.data, contact_type: contactType }
          : params.data,
      });
    },
    async update(resource, params) {
      const contactType = typeFor(resource);
      if (contactType) {
        assertType(
          resource,
          (await provider.getOne("contacts", { id: params.id }))
            .data as Contact,
        );
      }
      return provider.update(tableFor(resource), {
        ...params,
        data: contactType
          ? { ...params.data, contact_type: contactType }
          : params.data,
      });
    },
    async updateMany(resource, params) {
      if (typeFor(resource)) {
        const { data } = await provider.getMany<Contact>("contacts", {
          ids: params.ids,
        });
        if (
          data.length !== params.ids.length ||
          data.some((contact) => contact.contact_type !== typeFor(resource))
        ) {
          throw new Error(`Cannot update records outside ${resource}`);
        }
      }
      const contactType = typeFor(resource);
      return provider.updateMany(tableFor(resource), {
        ...params,
        data: contactType
          ? { ...params.data, contact_type: contactType }
          : params.data,
      });
    },
    async delete(resource, params) {
      if (typeFor(resource)) {
        assertType(
          resource,
          (await provider.getOne("contacts", { id: params.id }))
            .data as Contact,
        );
      }
      return provider.delete(tableFor(resource), params);
    },
    async deleteMany(resource, params) {
      if (typeFor(resource)) {
        const { data } = await provider.getMany<Contact>("contacts", {
          ids: params.ids,
        });
        if (
          data.length !== params.ids.length ||
          data.some((contact) => contact.contact_type !== typeFor(resource))
        ) {
          throw new Error(`Cannot delete records outside ${resource}`);
        }
      }
      return provider.deleteMany(tableFor(resource), params);
    },
  } as T;
};

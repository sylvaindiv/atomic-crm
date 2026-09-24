import { HttpError, type DataProvider } from "ra-core";

/**
 * Low-level data provider that talks to the Atomic CRM backend
 * (server/index.mjs) over HTTP. Each method POSTs to
 * `${API_URL}/:resource/:method` with a JSON body matching the react-admin
 * DataProvider params, and the backend returns the matching react-admin shape.
 *
 * The backend understands the app's PostgREST-style `field@operator` filters
 * directly, so filters are forwarded unchanged.
 */
const API_URL = import.meta.env.VITE_API_URL ?? "/api";

export async function apiFetch<T = any>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const response = await fetch(`${API_URL}/${path}`, {
    credentials: "include",
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  const json = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new HttpError(
      json?.error ?? response.statusText,
      response.status,
      json,
    );
  }
  return json as T;
}

export const apiPost = <T = any>(path: string, body: Record<string, unknown>) =>
  apiFetch<T>(path, { method: "POST", body: JSON.stringify(body) });

export const apiPatch = <T = any>(
  path: string,
  body: Record<string, unknown>,
) => apiFetch<T>(path, { method: "PATCH", body: JSON.stringify(body) });

const dataRequest = <T = any>(
  resource: string,
  method: string,
  body: Record<string, unknown>,
) => apiPost<T>(`${resource}/${method}`, body);

export const baseDataProvider: DataProvider = {
  getList: (resource, params) =>
    dataRequest(resource, "getList", {
      filter: params.filter,
      sort: params.sort,
      pagination: params.pagination,
    }),
  getOne: (resource, params) =>
    dataRequest(resource, "getOne", { id: params.id }),
  getMany: (resource, params) =>
    dataRequest(resource, "getMany", { ids: params.ids }),
  getManyReference: (resource, params) =>
    dataRequest(resource, "getManyReference", {
      target: params.target,
      id: params.id,
      filter: params.filter,
      sort: params.sort,
      pagination: params.pagination,
    }),
  create: (resource, params) =>
    dataRequest(resource, "create", { data: params.data }),
  update: (resource, params) =>
    dataRequest(resource, "update", { id: params.id, data: params.data }),
  updateMany: (resource, params) =>
    dataRequest(resource, "updateMany", { ids: params.ids, data: params.data }),
  delete: (resource, params) =>
    dataRequest(resource, "delete", { id: params.id }),
  deleteMany: (resource, params) =>
    dataRequest(resource, "deleteMany", { ids: params.ids }),
};

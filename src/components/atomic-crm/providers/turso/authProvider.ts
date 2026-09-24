import type { AuthProvider } from "ra-core";

import { canAccess } from "../commons/canAccess";
import { apiFetch, apiPost } from "./internal/httpClient";

export const SESSION_EVENT = "crm-session-changed";
const SESSION_STORAGE_KEY = "crm-session-event";

type SessionUser = {
  id: number;
  first_name: string;
  last_name: string;
  avatar?: { src?: string };
  administrator?: boolean;
};

type Session = { user: SessionUser; must_change_password: boolean };

let session: Session | null = null;

export function clearAuthState() {
  session = null;
}

export function setAuthSession(nextSession: Session) {
  session = nextSession;
}

export function notifySessionChanged() {
  if (typeof window === "undefined") return;
  localStorage.setItem(SESSION_STORAGE_KEY, Date.now().toString());
  window.dispatchEvent(new Event(SESSION_EVENT));
}

if (typeof window !== "undefined") {
  window.addEventListener("storage", (event) => {
    if (event.key === SESSION_STORAGE_KEY) window.location.reload();
  });
}

export function getIsInitialized(): Promise<boolean> {
  return Promise.resolve(true);
}

export function cacheCurrentSale(_sale: unknown) {}

export const getAuthProvider = (): AuthProvider => ({
  login: async ({ email, password }: { email?: string; password?: string }) => {
    const nextSession = await apiPost<Session>("auth/login", {
      email: email ?? "",
      password: password ?? "",
    });
    setAuthSession(nextSession);
    notifySessionChanged();
    return nextSession.must_change_password
      ? { redirectTo: "/change-password" }
      : undefined;
  },
  logout: async () => {
    try {
      await apiPost("auth/logout", {});
    } finally {
      clearAuthState();
      notifySessionChanged();
    }
    return undefined;
  },
  checkError: async (error: any) => {
    if (error?.status === 401) {
      clearAuthState();
      throw error;
    }
    if (
      error?.body?.code === "PASSWORD_CHANGE_REQUIRED" ||
      error?.message === "PASSWORD_CHANGE_REQUIRED"
    ) {
      throw { redirectTo: "/change-password" };
    }
  },
  checkAuth: async () => {
    session = await apiFetch<Session>("auth/me");
  },
  canAccess: async (params: any) => {
    const current = session ?? (await apiFetch<Session>("auth/me"));
    return canAccess(
      current.user.administrator ? "admin" : "user",
      params as any,
    );
  },
  getIdentity: async () => {
    const current = session ?? (await apiFetch<Session>("auth/me"));
    session = current;
    const sale = current.user;
    return {
      id: sale.id,
      fullName: `${sale.first_name} ${sale.last_name}`,
      avatar: sale.avatar?.src,
      must_change_password: current.must_change_password,
    };
  },
});

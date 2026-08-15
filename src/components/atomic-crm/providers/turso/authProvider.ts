import type { AuthProvider } from "ra-core";

import type { Sale } from "../../types";
import { canAccess } from "../commons/canAccess";
import { baseDataProvider } from "./internal/httpClient";

const PASSWORD = "bite";
const BLOCK_DURATION = 60 * 60 * 1000;
const MAX_ATTEMPTS = 3;
const AUTH_KEY = "app_auth";
const ATTEMPTS_KEY = "app_login_attempts";

interface LoginAttempts {
  count: number;
  blockedUntil: number | null;
}

function getAttempts(): LoginAttempts {
  if (typeof window === "undefined") return { count: 0, blockedUntil: null };
  const raw = localStorage.getItem(ATTEMPTS_KEY);
  if (!raw) return { count: 0, blockedUntil: null };
  try {
    return JSON.parse(raw);
  } catch {
    return { count: 0, blockedUntil: null };
  }
}

function setAttempts(data: LoginAttempts) {
  if (typeof window !== "undefined") {
    localStorage.setItem(ATTEMPTS_KEY, JSON.stringify(data));
  }
}

function isAuthenticated(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(AUTH_KEY) === "1";
}

export function getIsInitialized(): Promise<boolean> {
  return Promise.resolve(true);
}

export function cacheCurrentSale(_sale: any) {
  // no-op since we removed sign-up flow
}

// --- Identity resolution -----------------------------------------------------
// This is a single-user, no-login deployment (see the shared-password gate
// below): there is no real authentication, but every write (notes, contacts,
// tasks) still stamps `sales_id`, an INTEGER FK to `sales.id`. We treat
// the first `sales` row (by id) as "the" user, and self-provision a default
// one the first time the table is empty — the removed `/sign-up` onboarding
// used to create it.

async function fetchFirstSale(): Promise<Sale | null> {
  const { data } = await baseDataProvider.getList<Sale>("sales", {
    filter: {},
    pagination: { page: 1, perPage: 1 },
    sort: { field: "id", order: "ASC" },
  });
  return data[0] ?? null;
}

/**
 * Creates the default sales row the first time the table is empty.
 * Race-safe: `sales.email` is UNIQUE, so if a concurrent caller (another tab,
 * or a simultaneous request) already created the row, the insert fails and we
 * re-fetch the row it created instead of throwing.
 */
async function provisionDefaultSale(): Promise<Sale> {
  try {
    const { data } = await baseDataProvider.create<Sale>("sales", {
      data: {
        first_name: "Admin",
        last_name: "User",
        email: "admin@local",
        administrator: true,
        disabled: false,
        user_id: crypto.randomUUID(),
      } as Partial<Sale>,
    });
    return data;
  } catch (error) {
    const existing = await fetchFirstSale();
    if (existing) return existing;
    throw error;
  }
}

/** Resolves the current user: the first `sales` row, self-provisioned if none exists yet. */
async function getCurrentSale(): Promise<Sale> {
  const existing = await fetchFirstSale();
  if (existing) return existing;
  return provisionDefaultSale();
}

export const getAuthProvider = (): AuthProvider => ({
  login: async ({ password }: { password?: string }) => {
    const attempts = getAttempts();

    if (attempts.blockedUntil && Date.now() < attempts.blockedUntil) {
      const remaining = Math.ceil((attempts.blockedUntil - Date.now()) / 60000);
      throw new Error(
        `Trop de tentatives. Réessayez dans ${remaining} minute${remaining > 1 ? "s" : ""}.`,
      );
    }

    if (password !== PASSWORD) {
      const newCount = attempts.count + 1;
      if (newCount >= MAX_ATTEMPTS) {
        setAttempts({
          count: newCount,
          blockedUntil: Date.now() + BLOCK_DURATION,
        });
        throw new Error(
          "3 tentatives échouées. Compte bloqué pendant 1 heure.",
        );
      }
      setAttempts({ count: newCount, blockedUntil: null });
      throw new Error("Mot de passe incorrect.");
    }

    setAttempts({ count: 0, blockedUntil: null });
    if (typeof window !== "undefined") {
      localStorage.setItem(AUTH_KEY, "1");
    }
    return undefined;
  },
  logout: async () => {
    if (typeof window !== "undefined") {
      localStorage.removeItem(AUTH_KEY);
    }
    return undefined;
  },
  checkError: async () => undefined,
  checkAuth: async () => {
    if (!isAuthenticated()) {
      throw new Error("Not authenticated");
    }
  },
  canAccess: async (params: any) => {
    return canAccess("admin", params as any);
  },
  getIdentity: async () => {
    const sale = await getCurrentSale();
    return {
      id: sale.id,
      fullName: `${sale.first_name} ${sale.last_name}`,
      avatar: sale.avatar?.src,
    };
  },
});

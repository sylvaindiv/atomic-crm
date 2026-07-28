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

// This is a single-user, no-login deployment: there is no real
// authentication, just a shared app password (see PASSWORD above). The rest
// of the app still needs an "identity" — a real row in `sales` — for record
// ownership (sales_id foreign keys on contacts/contact_notes/deals/
// deal_notes) and role checks. There is no sign-up flow anymore to create
// that row, so getIdentity() resolves the first `sales` row and creates one
// on the fly if none exists. This makes it self-healing for databases that
// were already provisioned before a default row existed: db/seed.sql only
// ever runs once, on a brand-new database, so it can't fix those
// retroactively.
const DEFAULT_SALE_EMAIL = "admin@atomic-crm.invalid";

async function fetchFirstSale(): Promise<Sale | null> {
  const { data } = await baseDataProvider.getList<Sale>("sales", {
    filter: {},
    pagination: { page: 1, perPage: 1 },
    sort: { field: "id", order: "ASC" },
  });
  return data[0] ?? null;
}

async function createDefaultSale(): Promise<Sale> {
  const { data } = await baseDataProvider.create<Sale>("sales", {
    data: {
      email: DEFAULT_SALE_EMAIL,
      first_name: "Admin",
      last_name: "",
      administrator: true,
      disabled: false,
      user_id: crypto.randomUUID(),
    } as Partial<Sale>,
  });
  return data;
}

/**
 * Resolve the (only) sales row backing the app's identity, creating it if
 * this is the first time the app runs against this database. If two calls
 * race to create it at once, the losing INSERT fails on the email UNIQUE
 * constraint; re-reading the table then returns the winner's row instead of
 * failing the caller.
 */
async function ensureSale(): Promise<Sale> {
  const existing = await fetchFirstSale();
  if (existing) return existing;
  try {
    return await createDefaultSale();
  } catch (err) {
    const winner = await fetchFirstSale();
    if (winner) return winner;
    throw err;
  }
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
    const sale = await ensureSale();
    return {
      id: sale.id,
      fullName: `${sale.first_name} ${sale.last_name}`.trim() || "Admin",
      avatar: sale.avatar?.src,
    };
  },
});

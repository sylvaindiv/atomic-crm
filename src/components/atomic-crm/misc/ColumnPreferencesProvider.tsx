import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useDataProvider } from "ra-core";
import {
  ColumnPreferencesContext,
  type ColumnSettings,
} from "@/components/admin/column-preferences-context";
import type { CrmDataProvider } from "../providers/types";
import { columnPreferenceWrites } from "./columnPreferenceWrites";

export type ColumnResource = "companies" | "contacts" | "partners";
const defaults = (): ColumnSettings => ({ order: [], hidden: [], widths: {} });

export function ColumnPreferencesProvider({
  userId,
  resource,
  children,
}: {
  userId: string | number;
  resource: ColumnResource;
  children: ReactNode;
}) {
  const provider = useDataProvider<CrmDataProvider>();
  const queryClient = useQueryClient();
  const key = `columns:${userId}:${resource}`;
  const queryKey = useMemo(
    () => ["column-preferences", userId, resource],
    [userId, resource],
  );
  const query = useQuery({
    queryKey,
    queryFn: () => provider.getColumnPreferences(resource),
    retry: false,
    staleTime: Infinity,
  });
  const [settings, setSettings] = useState<ColumnSettings | null>(null);
  const settingsRef = useRef<ColumnSettings | null>(null);
  const [saveError, setSaveError] = useState(false);
  const [failed, setFailed] = useState<ColumnSettings | null>(null);

  useEffect(() => {
    if (query.isSuccess && settingsRef.current === null) {
      const loaded = query.data ?? defaults();
      settingsRef.current = loaded;
      setSettings(loaded);
    }
  }, [query.isSuccess, query.data]);

  const save = useCallback(
    (next: ColumnSettings) => {
      const pending = (columnPreferenceWrites.get(key) ?? Promise.resolve())
        .catch(() => undefined)
        .then(() => provider.saveColumnPreferences(resource, next));
      columnPreferenceWrites.set(key, pending);
      pending.then(
        () => {
          if (columnPreferenceWrites.get(key) !== pending) return;
          columnPreferenceWrites.delete(key);
          setSaveError(false);
          setFailed(null);
          queryClient.setQueryData(queryKey, next);
        },
        () => {
          if (columnPreferenceWrites.get(key) !== pending) return;
          columnPreferenceWrites.delete(key);
          setSaveError(true);
          setFailed(next);
        },
      );
    },
    [key, provider, queryClient, queryKey, resource],
  );

  const value = useMemo(
    () => ({
      settings: settings ?? defaults(),
      ready: settings !== null && !query.isError,
      error: query.isError,
      saveError,
      retry: () => {
        if (query.isError) void query.refetch();
        else if (failed) save(failed);
      },
      update: (change: (current: ColumnSettings) => ColumnSettings) => {
        if (settingsRef.current === null || query.isError) return;
        const next = change(settingsRef.current);
        settingsRef.current = next;
        setSettings(next);
        save(next);
      },
      reset: () => {
        if (settingsRef.current === null || query.isError) return;
        const next = defaults();
        settingsRef.current = next;
        setSettings(next);
        save(next);
      },
    }),
    [settings, query, saveError, failed, save],
  );

  return (
    <ColumnPreferencesContext.Provider value={value}>
      {children}
    </ColumnPreferencesContext.Provider>
  );
}

import { createContext, useContext } from "react";

export type ColumnSettings = {
  order: string[];
  hidden: string[];
  widths: Record<string, number>;
};

export type ColumnPreferences = {
  settings: ColumnSettings;
  ready: boolean;
  error: boolean;
  saveError: boolean;
  retry: () => void;
  update: (next: (settings: ColumnSettings) => ColumnSettings) => void;
  reset: () => void;
};

export const ColumnPreferencesContext = createContext<ColumnPreferences | null>(
  null,
);
export const useColumnPreferences = () => useContext(ColumnPreferencesContext);

export const orderedColumnIds = (ids: string[], saved: string[]) => [
  ...saved.filter((id) => ids.includes(id)),
  ...ids.filter((id) => !saved.includes(id)),
];

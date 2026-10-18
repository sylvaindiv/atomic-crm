import { useMemo } from "react";
import { useStore } from "ra-core";

import type { LabeledValue, NoteStatus } from "../types";
import {
  defaultConfiguration,
  normalizeClientChecklist,
  splitLegacyClientChecklist,
} from "./defaultConfiguration";

export const CONFIGURATION_STORE_KEY = "app.configuration";

export interface ConfigurationContextValue {
  companySectors: LabeledValue[];
  clientChecklist: LabeledValue[];
  clubChecklist: LabeledValue[];
  refereeChecklist: LabeledValue[];
  currency: string;
  noteStatuses: NoteStatus[];
  taskTypes: LabeledValue[];
  title: string;
  darkModeLogo: string;
  lightModeLogo: string;
  googleWorkplaceDomain?: string;
}

export const useConfigurationContext = () => {
  const [config] = useStore<ConfigurationContextValue>(
    CONFIGURATION_STORE_KEY,
    defaultConfiguration,
  );
  // Merge with defaults so that missing fields in stored config
  // fall back to default values (e.g. when new settings are added)
  return useMemo(() => {
    const legacy = normalizeClientChecklist(config.clientChecklist);
    const split = splitLegacyClientChecklist(
      config.clientChecklist === undefined
        ? defaultConfiguration.clientChecklist
        : legacy,
    );
    return {
      ...defaultConfiguration,
      ...config,
      clientChecklist: legacy,
      clubChecklist: config.clubChecklist ?? split.clubChecklist,
      refereeChecklist: config.refereeChecklist ?? split.refereeChecklist,
    };
  }, [config]);
};

export const useConfigurationUpdater = () => {
  const [, setConfig] = useStore<ConfigurationContextValue>(
    CONFIGURATION_STORE_KEY,
  );
  return setConfig;
};

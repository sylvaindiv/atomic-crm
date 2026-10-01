import { mergeTranslations } from "ra-core";
import polyglotI18nProvider from "ra-i18n-polyglot";
import englishMessages from "ra-language-english";
import frenchMessages from "ra-language-french";
import { englishCrmMessages } from "./englishCrmMessages";
import { frenchCrmMessages } from "./frenchCrmMessages";

const partnerCopy = (contacts: object, locale: "en" | "fr") => {
  let text = JSON.stringify(contacts);
  if (locale === "fr") {
    text = text
      .replaceAll("Juges-arbitres", "Partenaires")
      .replaceAll("juges-arbitres", "partenaires")
      .replaceAll("Juge-arbitre", "Partenaire")
      .replaceAll("juge-arbitre", "partenaire");
  } else {
    text = text
      .replaceAll("Judges-Referees", "Partners")
      .replaceAll("Judges-referees", "Partners")
      .replaceAll("Judge-Referee", "Partner")
      .replaceAll("Judge-referee", "Partner")
      .replaceAll("judges-referees", "partners")
      .replaceAll("judge-referee", "partner")
      .replaceAll("Referees", "Partners")
      .replaceAll("Referee", "Partner")
      .replaceAll("referees", "partners")
      .replaceAll("referee", "partner");
  }
  return JSON.parse(text);
};

const englishCatalog = mergeTranslations(englishMessages, englishCrmMessages, {
  resources: {
    partners: partnerCopy(englishCrmMessages.resources.contacts, "en"),
  },
});

const frenchCatalog = mergeTranslations(
  englishCatalog,
  frenchMessages,
  frenchCrmMessages,
  {
    resources: {
      partners: partnerCopy(frenchCrmMessages.resources.contacts, "fr"),
    },
  },
);

export const getInitialLocale = (): "en" | "fr" => {
  if (typeof navigator === "undefined") {
    return "en";
  }

  const browserLocale = navigator.languages?.[0] ?? navigator.language;
  if (browserLocale?.toLowerCase().startsWith("fr")) {
    return "fr";
  }

  return "en";
};

export const i18nProvider = polyglotI18nProvider(
  (locale) => {
    if (locale === "fr") {
      return frenchCatalog;
    }
    return englishCatalog;
  },
  getInitialLocale(),
  [
    { locale: "en", name: "English" },
    { locale: "fr", name: "Français" },
  ],
  { allowMissing: true },
);

export const testI18nProvider = polyglotI18nProvider(
  () => englishCatalog,
  "en",
  [{ locale: "en", name: "English" }],
  { allowMissing: true },
);

import type { LabeledValue } from "../types";

export const findDealLabel = (statuses: LabeledValue[], dealValue: string) => {
  const status = statuses.find((status) => status.value === dealValue);
  return status?.label;
};

export function getRelativeTimeString(
  dateString: string,
  locale = "en",
): string {
  const date = new Date(dateString);
  date.setHours(0, 0, 0, 0);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const diff = date.getTime() - today.getTime();
  const unitDiff = Math.round(diff / (1000 * 60 * 60 * 24));

  // Check if the date is more than one week old
  if (Math.abs(unitDiff) > 7) {
    return new Intl.DateTimeFormat(locale, {
      day: "numeric",
      month: "long",
    }).format(date);
  }

  // Intl.RelativeTimeFormat for dates within the last week
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
  return ucFirst(rtf.format(unitDiff, "day"));
}

function ucFirst(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/** Placeholder shown in place of a formatted amount when a deal has no budget set. */
const DEAL_AMOUNT_PLACEHOLDER = "–"; // en dash

/**
 * Formats a deal's amount as compact currency, or a placeholder when the
 * deal has no budget (amount is optional -- see Deal['amount']). Factors out
 * the currency-formatting options duplicated across every deal amount
 * display site (DealShow, DealColumn, CompanyShow).
 */
export function formatDealAmount(
  amount: number | null | undefined,
  currency: string,
): string {
  if (amount == null) return DEAL_AMOUNT_PLACEHOLDER;
  return amount.toLocaleString("en-US", {
    notation: "compact",
    style: "currency",
    currency,
    currencyDisplay: "narrowSymbol",
    minimumSignificantDigits: 3,
  });
}

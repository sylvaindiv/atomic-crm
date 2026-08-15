/** Placeholder shown in place of a formatted amount when there is no budget set. */
const AMOUNT_PLACEHOLDER = "–"; // en dash

/**
 * Formats an optional monetary amount as compact currency, or a placeholder
 * when there is none (amount is always optional -- see Deal['amount'] /
 * Contact['amount']). Deal-free so it can be shared by the contact page, the
 * Kanban card and the dashboard without pulling in the deals module; see
 * `deals/dealUtils.ts` for the re-export kept for the still-existing deal
 * screens.
 */
export function formatDealAmount(
  amount: number | null | undefined,
  currency: string,
): string {
  if (amount == null) return AMOUNT_PLACEHOLDER;
  return amount.toLocaleString("en-US", {
    notation: "compact",
    style: "currency",
    currency,
    currencyDisplay: "narrowSymbol",
    minimumSignificantDigits: 3,
  });
}

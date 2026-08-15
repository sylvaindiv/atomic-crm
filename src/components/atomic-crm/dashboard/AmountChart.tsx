import { ResponsiveBar } from "@nivo/bar";
import { format, startOfMonth } from "date-fns";
import { TrendingUp } from "lucide-react";
import { useGetList, useTranslate } from "ra-core";
import { memo, useMemo } from "react";

import { useConfigurationContext } from "../root/ConfigurationContext";
import type { Contact } from "../types";

/** Status value counted as won -- the judge/club "Client" status. */
export const WON_STAGE_VALUE = "client";
/** Status value counted as lost -- the judge/club "Mort" status. */
export const LOST_STAGE_VALUE = "mort";
/** Flat weight applied to every pending contact's amount (no per-status weighting). */
export const PENDING_STAGE_WEIGHT = 0.5;

export type DealStageBucket = "won" | "lost" | "pending";

/**
 * Buckets a contact's status value into won / lost / pending for dashboard
 * aggregation, and returns the weight to apply to the contact's amount.
 *
 * Only `client` counts as won and `mort` as lost. Every other status --
 * including legacy generic-pipeline values (`won`, `lost`, `opportunity`,
 * ...) or any status added later in Settings -- falls into the pending
 * bucket with the same flat weight, since per-status weighting no longer has
 * meaning once statuses are judge/club statuses. Pure and total: it never
 * throws and never returns NaN, whatever string (or empty/undefined value)
 * is passed in.
 */
export function getDealStageBucket(stage: string | undefined | null): {
  bucket: DealStageBucket;
  weight: number;
} {
  if (stage === WON_STAGE_VALUE) {
    return { bucket: "won", weight: 1 };
  }
  if (stage === LOST_STAGE_VALUE) {
    return { bucket: "lost", weight: 1 };
  }
  return { bucket: "pending", weight: PENDING_STAGE_WEIGHT };
}

export type MonthTotals = {
  date: string;
  won: number;
  pending: number;
  lost: number;
};

/**
 * Folds one contact's bucketed, weighted amount into a month's running
 * totals, returning a new object. Null-safe: a missing/undefined amount
 * contributes 0 and never produces NaN.
 */
export function accumulateContactAmount(
  totals: MonthTotals,
  contact: Pick<Contact, "status" | "amount">,
): MonthTotals {
  const { bucket, weight } = getDealStageBucket(contact.status);
  const amount = contact.amount ?? 0;
  if (bucket === "won") {
    return { ...totals, won: totals.won + amount };
  }
  if (bucket === "lost") {
    return { ...totals, lost: totals.lost - amount };
  }
  return { ...totals, pending: totals.pending + amount * weight };
}

const threeMonthsAgo = new Date(
  new Date().setMonth(new Date().getMonth() - 6),
).toISOString();

const DEFAULT_LOCALE = "en-US";

export const AmountChart = memo(() => {
  const translate = useTranslate();
  const { noteStatuses, currency } = useConfigurationContext();
  const acceptedLanguages = navigator
    ? navigator.languages || [navigator.language]
    : [DEFAULT_LOCALE];
  const wonLabel =
    noteStatuses.find((status) => status.value === WON_STAGE_VALUE)?.label ??
    "Won";
  const lostLabel =
    noteStatuses.find((status) => status.value === LOST_STAGE_VALUE)?.label ??
    "Lost";

  const { data, isPending } = useGetList<Contact>("contacts", {
    pagination: { perPage: 100, page: 1 },
    sort: {
      field: "first_seen",
      order: "ASC",
    },
    filter: {
      "first_seen@gte": threeMonthsAgo,
    },
  });
  const months = useMemo(() => {
    if (!data) return [];
    const contactsByMonth = data.reduce((acc, contact) => {
      const month = startOfMonth(
        contact.first_seen ?? new Date(),
      ).toISOString();
      if (!acc[month]) {
        acc[month] = [];
      }
      acc[month].push(contact);
      return acc;
    }, {} as any);

    const amountByMonth = Object.keys(contactsByMonth).map((month) => {
      return contactsByMonth[month].reduce(
        accumulateContactAmount,
        { date: format(month, "MMM"), won: 0, pending: 0, lost: 0 },
      );
    });

    return amountByMonth;
  }, [data]);

  if (isPending) return null; // FIXME return skeleton instead
  const range = months.reduce(
    (acc, month) => {
      acc.min = Math.min(acc.min, month.lost);
      acc.max = Math.max(acc.max, month.won + month.pending);
      return acc;
    },
    { min: 0, max: 0 },
  );
  return (
    <div className="flex flex-col">
      <div className="flex items-center mb-4">
        <div className="mr-3 flex">
          <TrendingUp className="text-muted-foreground w-6 h-6" />
        </div>
        <h2 className="text-xl font-semibold text-muted-foreground">
          {translate("crm.dashboard.amount_chart")}
        </h2>
      </div>
      <div className="h-[400px]">
        <ResponsiveBar
          data={months}
          indexBy="date"
          keys={["won", "pending", "lost"]}
          colors={["#61cdbb", "#97e3d5", "#e25c3b"]}
          margin={{ top: 30, right: 50, bottom: 30, left: 0 }}
          padding={0.3}
          valueScale={{
            type: "linear",
            min: range.min * 1.2,
            max: range.max * 1.2,
          }}
          indexScale={{ type: "band", round: true }}
          enableGridX={true}
          enableGridY={false}
          enableLabel={false}
          tooltip={({ value, indexValue }) => (
            <div className="p-2 bg-secondary rounded shadow inline-flex items-center gap-1 text-secondary-foreground">
              <strong>{indexValue}: </strong>&nbsp;{value > 0 ? "+" : ""}
              {value.toLocaleString(acceptedLanguages.at(0) ?? DEFAULT_LOCALE, {
                style: "currency",
                currency,
              })}
            </div>
          )}
          axisTop={{
            tickSize: 0,
            tickPadding: 12,
            style: {
              ticks: {
                text: {
                  fill: "var(--color-muted-foreground)",
                },
              },
              legend: {
                text: {
                  fill: "var(--color-muted-foreground)",
                },
              },
            },
          }}
          axisBottom={{
            legendPosition: "middle",
            legendOffset: 50,
            tickSize: 0,
            tickPadding: 12,
            style: {
              ticks: {
                text: {
                  fill: "var(--color-muted-foreground)",
                },
              },
              legend: {
                text: {
                  fill: "var(--color-muted-foreground)",
                },
              },
            },
          }}
          axisLeft={null}
          axisRight={{
            format: (v: any) => `${Math.abs(v / 1000)}k`,
            tickValues: 8,
            style: {
              ticks: {
                text: {
                  fill: "var(--color-muted-foreground)",
                },
              },
              legend: {
                text: {
                  fill: "var(--color-muted-foreground)",
                },
              },
            },
          }}
          markers={
            [
              {
                axis: "y",
                value: 0,
                lineStyle: { strokeOpacity: 0 },
                textStyle: { fill: "#2ebca6" },
                legend: wonLabel,
                legendPosition: "top-left",
                legendOrientation: "vertical",
              },
              {
                axis: "y",
                value: 0,
                lineStyle: {
                  stroke: "#f47560",
                  strokeWidth: 1,
                },
                textStyle: { fill: "#e25c3b" },
                legend: lostLabel,
                legendPosition: "bottom-left",
                legendOrientation: "vertical",
              },
            ] as any
          }
        />
      </div>
    </div>
  );
});

import type { DataProvider, Identifier } from "ra-core";

import type { Deal, Task } from "../types";

/**
 * The mini-form's non-persisted `next_action` namespace, mirroring the field
 * shape of `TaskFormContent` (text, type, due_date), all required. Never
 * written to the deal record itself -- see `transformDealWithNextAction`.
 */
export type NextActionValues = Pick<Task, "text" | "type" | "due_date">;

export type DealWithNextAction = Deal & { next_action?: NextActionValues };

/**
 * Returns the given contact's earliest open task (`done_date` null, sorted
 * by `due_date` ascending, first result) -- a single perPage-1 paginated
 * query, no full task list fetch.
 */
export const getEarliestOpenTask = async (
  dataProvider: DataProvider,
  contactId: Identifier,
): Promise<Task | undefined> => {
  const { data } = await dataProvider.getList<Task>("tasks", {
    pagination: { page: 1, perPage: 1 },
    sort: { field: "due_date", order: "ASC" },
    filter: { contact_id: contactId, "done_date@is": null },
  });
  return data[0];
};

/**
 * Strips the non-persisted `next_action` namespace off a submitted deal and
 * upserts it onto the linked contact's earliest open task before the deal
 * itself is written -- `dataProvider.update` when one exists,
 * `dataProvider.create` otherwise. Re-resolves the contact's current
 * earliest open task rather than trusting a value cached at form-open time,
 * and re-validates that a complete next action is present so the mandatory
 * rule holds on the submit path, not only in the form's `required()`
 * validators. Throws -- aborting the deal save -- when the next action is
 * incomplete or the task upsert fails.
 *
 * Used as the deal form's async `transform`, from both `DealCreate` and
 * `DealEdit` -- see `ContactCreate.tsx`'s `cleanupContactForCreate` for the
 * same pre-save side-write pattern.
 */
export const transformDealWithNextAction = async (
  dataProvider: DataProvider,
  values: DealWithNextAction,
  salesId?: Identifier,
): Promise<Deal> => {
  const { next_action: nextAction, ...deal } = values;
  const contactId = deal.contact_ids?.[0];

  if (
    contactId == null ||
    !nextAction?.text ||
    !nextAction?.type ||
    !nextAction?.due_date
  ) {
    throw new Error("A deal cannot be saved without a complete next action.");
  }

  const existingTask = await getEarliestOpenTask(dataProvider, contactId);
  if (existingTask) {
    await dataProvider.update("tasks", {
      id: existingTask.id,
      data: { ...nextAction, contact_id: contactId },
      previousData: existingTask,
    });
  } else {
    await dataProvider.create("tasks", {
      data: { ...nextAction, contact_id: contactId, sales_id: salesId },
    });
  }

  return deal;
};

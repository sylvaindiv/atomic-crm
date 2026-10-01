import type { Identifier } from "ra-core";

export type NextActionInput =
  | { mode: "create"; text: string; due_date: string }
  | { mode: "existing"; task_id: Identifier };

export const validateNextAction = (
  value: unknown,
): value is NextActionInput => {
  if (!value || typeof value !== "object") return false;
  const action = value as Record<string, unknown>;
  if (action.mode === "create") {
    return (
      Object.keys(action).sort().join(",") === "due_date,mode,text" &&
      typeof action.text === "string" &&
      action.text.trim().length > 0 &&
      typeof action.due_date === "string" &&
      isValidDueDate(action.due_date)
    );
  }
  return (
    action.mode === "existing" &&
    Object.keys(action).sort().join(",") === "mode,task_id" &&
    ((typeof action.task_id === "string" &&
      /^[1-9]\d*$/.test(action.task_id)) ||
      (typeof action.task_id === "number" &&
        Number.isSafeInteger(action.task_id) &&
        action.task_id > 0))
  );
};

export const isValidDueDate = (value: string) => {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const date = new Date(`${value}T00:00:00.000Z`);
    return (
      !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value
    );
  }
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)) {
    return false;
  }
  const date = new Date(value);
  return !Number.isNaN(date.valueOf()) && date.toISOString() === value;
};

export const validateNoteOrAttachmentRequired = (
  value: string | null | undefined,
  values: { attachments?: unknown[] | null },
) => {
  const hasText = typeof value === "string" && value.trim().length > 0;
  const hasAttachments =
    Array.isArray(values?.attachments) && values.attachments.length > 0;

  return hasText || hasAttachments
    ? undefined
    : "resources.notes.validation.note_or_attachment_required";
};

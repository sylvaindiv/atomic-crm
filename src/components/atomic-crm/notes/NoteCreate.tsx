import {
  CreateBase,
  Form,
  useGetIdentity,
  useNotify,
  useRecordContext,
  useTranslate,
} from "ra-core";
import { useQueryClient } from "@tanstack/react-query";
import { useFormContext } from "react-hook-form";
import { SaveButton } from "@/components/admin/form";
import { cn } from "@/lib/utils";

import { NoteInputs } from "./NoteInputs";
import { getCurrentDate } from "./utils";
import { foreignKeyMapping } from "./foreignKeyMapping";
import { NextActionInputs } from "./NextActionInputs";

export const NoteCreate = ({
  reference,
  showStatus,
  className,
}: {
  reference: "contacts" | "partners";
  showStatus?: boolean;
  className?: string;
}) => {
  const record = useRecordContext();
  const { identity } = useGetIdentity();

  if (!record || !identity) return null;

  const defaultStatus = record.status;

  return (
    <CreateBase
      resource="contact_notes"
      redirect={false}
      transform={(data: any) => ({
        ...data,
        [foreignKeyMapping[reference]]: record.id,
        sales_id: identity.id,
        date: new Date(data.date || getCurrentDate()).toISOString(),
      })}
    >
      <Form>
        <div className={cn("space-y-3", className)}>
          <NoteInputs defaultStatus={defaultStatus} showStatus={showStatus} />
          <NextActionInputs defaultContactId={record.id} />
          <NoteCreateButton defaultStatus={defaultStatus} />
        </div>
      </Form>
    </CreateBase>
  );
};

const NoteCreateButton = ({ defaultStatus }: { defaultStatus?: string }) => {
  const notify = useNotify();
  const translate = useTranslate();
  const { identity } = useGetIdentity();
  const { reset } = useFormContext();
  const queryClient = useQueryClient();

  if (!identity) return null;

  const resetValues: {
    date: string;
    text: null;
    attachments: null;
    status?: string;
  } = {
    date: getCurrentDate(),
    text: null,
    attachments: null,
  };

  const handleSuccess = (data: any) => {
    resetValues.status = data.status ?? defaultStatus;

    reset(resetValues, { keepValues: false });
    queryClient.invalidateQueries({ queryKey: ["contact_notes", "getList"] });
    queryClient.invalidateQueries({ queryKey: ["tasks", "getList"] });
    queryClient.invalidateQueries({ queryKey: ["contacts"] });
    notify("resources.notes.added", {
      messageArgs: {
        _: "Note added",
      },
    });
  };

  return (
    <div className="flex justify-end">
      <SaveButton
        type="button"
        label={translate("resources.notes.action.add_this")}
        mutationOptions={{
          onSuccess: handleSuccess,
        }}
      />
    </div>
  );
};

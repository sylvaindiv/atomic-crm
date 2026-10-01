import { useQueryClient } from "@tanstack/react-query";
import { Save } from "lucide-react";
import { useMemo } from "react";
import {
  EditBase,
  Form,
  required,
  useInput,
  useNotify,
  useTranslate,
} from "ra-core";

import { ArrayInput } from "@/components/admin/array-input";
import { SimpleFormIterator } from "@/components/admin/simple-form-iterator";
import { TextInput } from "@/components/admin/text-input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

import { MobileContent } from "../layout/MobileContent";
import MobileHeader from "../layout/MobileHeader";
import {
  useConfigurationContext,
  useConfigurationUpdater,
} from "../root/ConfigurationContext";
import type { LabeledValue } from "../types";

export const ClientChecklistFields = () => {
  const translate = useTranslate();

  return (
    <div className="space-y-2">
      <h3 className="text-lg font-medium text-muted-foreground">
        {translate("crm.clients.checklist.settings_title", {
          _: "Client checklist",
        })}
      </h3>
      <ArrayInput source="clientChecklist" label={false} helperText={false}>
        <SimpleFormIterator>
          <ChecklistIdInput />
          <TextInput
            source="label"
            label="crm.clients.checklist.name"
            validate={required()}
            className="flex-1"
          />
        </SimpleFormIterator>
      </ArrayInput>
    </div>
  );
};

const ChecklistIdInput = () => {
  const { field } = useInput({
    source: "value",
    defaultValue: crypto.randomUUID(),
  });
  return <input type="hidden" {...field} />;
};

const withChecklist = (items: LabeledValue[] | undefined) =>
  items?.map((item) => ({
    ...item,
    value: item.value || crypto.randomUUID(),
  })) ?? [];

export const ClientChecklistSettingsPage = () => {
  const config = useConfigurationContext();
  const updateConfiguration = useConfigurationUpdater();
  const queryClient = useQueryClient();
  const notify = useNotify();
  const translate = useTranslate();
  const defaultValues = useMemo(
    () => ({ clientChecklist: config.clientChecklist }),
    [config.clientChecklist],
  );

  return (
    <EditBase
      resource="configuration"
      id={1}
      mutationMode="pessimistic"
      redirect={false}
      transform={(data: { clientChecklist?: LabeledValue[] }) => ({
        config: {
          ...config,
          clientChecklist: withChecklist(data.clientChecklist),
        },
      })}
      mutationOptions={{
        onSuccess: (data: any) => {
          updateConfiguration(data.config);
          queryClient.setQueryData(
            ["configuration", "getOne", { id: 1, meta: undefined }],
            data,
          );
          void queryClient.invalidateQueries({ queryKey: ["configuration"] });
          notify("crm.clients.checklist.saved");
        },
        onError: () =>
          notify("crm.clients.checklist.save_error", {
            type: "error",
            messageArgs: { _: "Could not save the checklist" },
          }),
      }}
    >
      <Form defaultValues={defaultValues}>
        <MobileHeader>
          <h1 className="text-xl font-semibold">
            {translate("crm.clients.checklist.settings_title", {
              _: "Client checklist",
            })}
          </h1>
        </MobileHeader>
        <MobileContent>
          <Card>
            <CardContent className="space-y-4">
              <ClientChecklistFields />
              <div className="flex justify-end">
                <Button type="submit">
                  <Save className="size-4 mr-1" />
                  {translate("ra.action.save")}
                </Button>
              </div>
            </CardContent>
          </Card>
        </MobileContent>
      </Form>
    </EditBase>
  );
};

ClientChecklistSettingsPage.path = "/settings/clients";

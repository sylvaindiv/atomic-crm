import { useQueryClient } from "@tanstack/react-query";
import { Save } from "lucide-react";
import { useMemo } from "react";
import { Link } from "react-router";
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
import { useIsMobile } from "@/hooks/use-mobile";

import { MobileContent } from "../layout/MobileContent";
import MobileHeader from "../layout/MobileHeader";
import {
  useConfigurationContext,
  useConfigurationUpdater,
} from "../root/ConfigurationContext";
import { normalizeClientChecklist } from "../root/defaultConfiguration";
import type { LabeledValue } from "../types";

export const ClientChecklistFields = ({
  showTitle = true,
  source = "clubChecklist",
  title,
}: {
  showTitle?: boolean;
  source?: "clubChecklist" | "refereeChecklist";
  title?: string;
}) => {
  const translate = useTranslate();

  return (
    <div className="space-y-2">
      {showTitle && (
        <h3 className="text-lg font-medium text-muted-foreground">
          {translate(
            source === "clubChecklist"
              ? "crm.clients.checklist.club_title"
              : "crm.clients.checklist.referee_title",
            {
              _:
                title ??
                (source === "clubChecklist"
                  ? "Étapes club"
                  : "Étapes juge-arbitre"),
            },
          )}
        </h3>
      )}
      <p className="text-sm text-muted-foreground">
        {translate(
          source === "clubChecklist"
            ? "crm.clients.checklist.club_description"
            : "crm.clients.checklist.referee_description",
          {
            _:
              source === "clubChecklist"
                ? "Pour tous les clubs clients"
                : "Pour chaque juge-arbitre suivi",
          },
        )}
      </p>
      <ArrayInput source={source} label={false} helperText={false}>
        <SimpleFormIterator className="[&>ul>li]:flex-col [&>ul>li]:items-stretch sm:[&>ul>li]:flex-row sm:[&>ul>li]:items-start [&>ul>li>.simple-form-iterator-item-actions]:self-end [&>ul>li>.simple-form-iterator-item-actions]:pt-0">
          <ChecklistIdInput />
          <TextInput
            source="label"
            label="crm.clients.checklist.name"
            validate={required()}
            className="w-full"
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
  const isMobile = useIsMobile();
  const defaultValues = useMemo(
    () => ({
      clubChecklist: config.clubChecklist,
      refereeChecklist: config.refereeChecklist,
    }),
    [config.clubChecklist, config.refereeChecklist],
  );

  return (
    <EditBase
      resource="configuration"
      id={1}
      mutationMode="pessimistic"
      redirect={false}
      transform={(data: {
        clubChecklist?: LabeledValue[];
        refereeChecklist?: LabeledValue[];
      }) => {
        const clubChecklist = normalizeClientChecklist(
          withChecklist(data.clubChecklist),
        );
        const refereeChecklist = normalizeClientChecklist(
          withChecklist(data.refereeChecklist),
        );
        return {
          config: {
            ...config,
            clientChecklist: [...clubChecklist, ...refereeChecklist],
            clubChecklist,
            refereeChecklist,
          },
        };
      }}
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
        {isMobile ? (
          <MobileHeader>
            <h1 className="text-lg font-semibold">
              {translate("crm.clients.checklist.settings_title", {
                _: "Étapes clients",
              })}
            </h1>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/clients">
                {translate("crm.clients.checklist.back", { _: "Clients" })}
              </Link>
            </Button>
          </MobileHeader>
        ) : null}
        <MobileContent>
          <div className={isMobile ? "" : "mx-auto my-4 max-w-3xl px-4"}>
            {!isMobile && (
              <div className="mb-4 flex items-center justify-between gap-4">
                <h1 className="text-2xl font-semibold">
                  {translate("crm.clients.checklist.settings_title", {
                    _: "Étapes clients",
                  })}
                </h1>
                <Button variant="outline" asChild>
                  <Link to="/clients">
                    {translate("crm.clients.checklist.back", {
                      _: "Retour aux clients",
                    })}
                  </Link>
                </Button>
              </div>
            )}
            <Card>
              <CardContent className="space-y-4">
                <ClientChecklistFields source="clubChecklist" />
                <ClientChecklistFields source="refereeChecklist" />
                <div className="flex justify-end">
                  <Button type="submit">
                    <Save className="size-4 mr-1" />
                    {translate("ra.action.save")}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </MobileContent>
      </Form>
    </EditBase>
  );
};

ClientChecklistSettingsPage.path = "/settings/clients";

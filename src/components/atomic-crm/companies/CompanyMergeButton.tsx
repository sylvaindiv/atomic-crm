import { useState, useEffect } from "react";
import { Merge, CircleX, AlertTriangle, ArrowDown } from "lucide-react";
import {
  useDataProvider,
  useRecordContext,
  useGetManyReference,
  required,
  Form,
  useNotify,
  useRedirect,
  useTranslate,
} from "ra-core";
import type { Identifier } from "ra-core";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ReferenceInput } from "@/components/admin/reference-input";
import { AutocompleteInput } from "@/components/admin/autocomplete-input";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import type { Company } from "../types";
import { findDuplicateCompanies } from "../providers/commons/findDuplicateCompanies";

export const CompanyMergeButton = () => {
  const translate = useTranslate();
  const [mergeDialogOpen, setMergeDialogOpen] = useState(false);
  return (
    <>
      <Button
        variant="outline"
        className="h-6 cursor-pointer"
        size="sm"
        onClick={() => setMergeDialogOpen(true)}
      >
        <Merge className="w-4 h-4" />
        {translate("resources.companies.merge.action", {
          _: "Merge with another club",
        })}
      </Button>
      <CompanyMergeDialog
        open={mergeDialogOpen}
        onClose={() => setMergeDialogOpen(false)}
      />
    </>
  );
};

interface CompanyMergeDialogProps {
  open: boolean;
  onClose: () => void;
}

const CompanyMergeDialog = ({ open, onClose }: CompanyMergeDialogProps) => {
  const loserCompany = useRecordContext<Company>();
  const notify = useNotify();
  const redirect = useRedirect();
  const translate = useTranslate();
  const dataProvider = useDataProvider();
  const [winnerId, setWinnerId] = useState<Identifier | null>(null);
  const [suggestedWinnerId, setSuggestedWinnerId] = useState<Identifier | null>(
    null,
  );
  const [isMerging, setIsMerging] = useState(false);
  const { mutateAsync } = useMutation({
    mutationKey: ["companies", "merge", { loserId: loserCompany?.id, winnerId }],
    mutationFn: async () => {
      return dataProvider.mergeCompanies(loserCompany?.id, winnerId);
    },
  });

  // Find potential duplicate clubs by normalized name -- the only usable
  // signal, since no company row has phone_number/website/address populated.
  const { data: duplicateCandidates } = useQuery({
    queryKey: ["companies", "findDuplicateCompanies", loserCompany?.id],
    queryFn: () =>
      findDuplicateCompanies(loserCompany as Company, dataProvider),
    enabled: open && !!loserCompany,
  });

  // Get counts of items to be reassigned
  const canFetchCounts = open && !!loserCompany && !!winnerId;
  const { total: contactsCount } = useGetManyReference(
    "contacts",
    {
      target: "company_id",
      id: loserCompany?.id,
      pagination: { page: 1, perPage: 1 },
    },
    { enabled: canFetchCounts },
  );

  const { total: dealsCount } = useGetManyReference(
    "deals",
    {
      target: "company_id",
      id: loserCompany?.id,
      pagination: { page: 1, perPage: 1 },
    },
    { enabled: canFetchCounts },
  );

  useEffect(() => {
    // A single, name-only match reason (unlike contacts' name/email/phone
    // union), so the first candidate found is auto-preselected.
    const firstCandidate = duplicateCandidates?.[0];
    if (firstCandidate) {
      setSuggestedWinnerId(firstCandidate.id);
      setWinnerId(firstCandidate.id);
    }
  }, [duplicateCandidates]);

  const handleMerge = async () => {
    if (!winnerId || !loserCompany) {
      notify("resources.companies.merge.select_target", {
        type: "warning",
        messageArgs: {
          _: "Please select a club to merge with",
        },
      });
      return;
    }

    try {
      setIsMerging(true);
      await mutateAsync();
      setIsMerging(false);
      notify("resources.companies.merge.success", {
        type: "success",
        messageArgs: {
          _: "Clubs merged successfully",
        },
      });
      redirect(`/companies/${winnerId}/show`);
      onClose();
    } catch (error) {
      setIsMerging(false);
      notify("resources.companies.merge.error", {
        type: "error",
        messageArgs: {
          _: "Failed to merge clubs",
        },
      });
      console.error("Merge failed:", error);
    }
  };

  if (!loserCompany) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="md:min-w-lg max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {translate("resources.companies.merge.title", {
              _: "Merge Club",
            })}
          </DialogTitle>
          <DialogDescription>
            {translate("resources.companies.merge.description", {
              _: "Merge this club with another one.",
            })}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="p-4 bg-primary/5 rounded-lg border border-primary/20">
            <p className="font-medium text-sm">
              {translate("resources.companies.merge.current_contact", {
                _: "Current Club (will be deleted)",
              })}
            </p>
            <div className="font-medium text-sm mt-4">
              {loserCompany.name}
            </div>

            <div className="flex justify-center my-4">
              <ArrowDown className="h-5 w-5 text-muted-foreground" />
            </div>

            <p className="font-medium text-sm mb-2">
              {translate("resources.companies.merge.target_contact", {
                _: "Target Club (will be kept)",
              })}
            </p>
            <Form>
              <ReferenceInput
                source="winner_id"
                reference="companies"
                filter={{ "id@neq": loserCompany.id }}
              >
                <AutocompleteInput
                  label=""
                  optionText="name"
                  validate={required()}
                  onChange={setWinnerId}
                  defaultValue={suggestedWinnerId}
                  helperText={false}
                />
              </ReferenceInput>
            </Form>
          </div>

          {winnerId && (
            <>
              <div className="space-y-2">
                <p className="font-medium text-sm">
                  {translate("resources.companies.merge.what_will_be_merged", {
                    _: "What will be merged:",
                  })}
                </p>
                <ul className="text-sm text-muted-foreground space-y-1 ml-4">
                  {contactsCount != null && contactsCount > 0 && (
                    <li>
                      • {contactsCount} judge-referee
                      {contactsCount !== 1 ? "s" : ""} will be reassigned
                    </li>
                  )}
                  {dealsCount != null && dealsCount > 0 && (
                    <li>
                      • {dealsCount} deal
                      {dealsCount !== 1 ? "s" : ""} will be reassigned
                    </li>
                  )}
                  {!contactsCount && !dealsCount && (
                    <li className="text-muted-foreground/60">
                      {translate("resources.companies.merge.no_additional_data", {
                        _: "No additional data to merge",
                      })}
                    </li>
                  )}
                </ul>
              </div>
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>
                  {translate("resources.companies.merge.warning_title", {
                    _: "Warning: Destructive Operation",
                  })}
                </AlertTitle>
                <AlertDescription>
                  {translate("resources.companies.merge.warning_description", {
                    _: "All data will be transferred to the second club. This action cannot be undone.",
                  })}
                </AlertDescription>
              </Alert>
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={isMerging}>
            <CircleX />
            {translate("ra.action.cancel")}
          </Button>
          <Button onClick={handleMerge} disabled={!winnerId || isMerging}>
            <Merge />
            {isMerging
              ? translate("resources.companies.merge.merging", {
                  _: "Merging...",
                })
              : translate("resources.companies.merge.confirm", {
                  _: "Merge Clubs",
                })}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

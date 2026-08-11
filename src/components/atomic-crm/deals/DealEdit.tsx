import {
  EditBase,
  Form,
  useDataProvider,
  useEditContext,
  useGetIdentity,
  useNotify,
  useRecordContext,
  useRedirect,
  useTranslate,
} from "ra-core";
import { Link } from "react-router";
import { DeleteButton } from "@/components/admin/delete-button";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";

import { FormToolbar } from "../layout/FormToolbar";
import type { Deal } from "../types";
import { DealInputs } from "./DealInputs";
import { DealCaseTypeBadge, DealPartyAvatar } from "./DealParty";
import {
  transformDealWithNextAction,
  type DealWithNextAction,
} from "./dealNextAction";

export const DealEdit = ({ open, id }: { open: boolean; id?: string }) => {
  const redirect = useRedirect();
  const notify = useNotify();
  const dataProvider = useDataProvider();
  const { identity } = useGetIdentity();

  const handleClose = () => {
    redirect("/deals", undefined, undefined, undefined, {
      _scrollToTop: false,
    });
  };

  // Strips `next_action` off the submitted deal and upserts it onto the
  // linked contact's earliest open task before the deal is written -- a
  // deal can never be saved without one. See dealNextAction.ts.
  const transform = async (values: DealWithNextAction) => {
    try {
      return await transformDealWithNextAction(
        dataProvider,
        values,
        identity?.id,
      );
    } catch (error) {
      notify("resources.deals.next_action_save_error", { type: "error" });
      throw error;
    }
  };

  return (
    <Dialog open={open} onOpenChange={() => handleClose()}>
      <DialogContent className="lg:max-w-4xl p-4 overflow-y-auto max-h-9/10 top-1/20 translate-y-0">
        {id ? (
          <EditBase
            id={id}
            mutationMode="pessimistic"
            transform={transform}
            // Without an explicit `loading` element, ra-core's EditBase
            // renders its children as soon as it mounts, before the record
            // has been fetched (see ra-core's EditBase: `showLoading` only
            // gates rendering when `loading` is set). That let DealInputs
            // mount with an undefined record, so `useDealCaseType()` fell
            // back to the (also-empty) watched form value and picked the
            // wrong "Lie a" branch for a beat -- and in fast/cached fetches
            // it could still be showing that first, wrong render by the
            // time the dialog is visually settled. Render nothing until the
            // real record is in context, exactly like DealShowContent does.
            loading={null}
            mutationOptions={{
              onSuccess: () => {
                notify("resources.deals.updated", {});
                redirect(`/deals/${id}/show`, undefined, undefined, undefined, {
                  _scrollToTop: false,
                });
              },
            }}
          >
            <EditHeader />
            <Form>
              <DealInputs />
              <FormToolbar />
            </Form>
          </EditBase>
        ) : null}
      </DialogContent>
    </Dialog>
  );
};

function EditHeader() {
  const translate = useTranslate();
  const { defaultTitle } = useEditContext<Deal>();
  const deal = useRecordContext<Deal>();
  if (!deal) {
    return null;
  }

  return (
    <DialogTitle className="pb-0">
      <div className="flex justify-between items-start mb-8">
        <div className="flex items-center gap-4">
          <DealPartyAvatar deal={deal} linkToShow />
          <h2 className="text-2xl font-semibold">{defaultTitle}</h2>
          <DealCaseTypeBadge caseType={deal.case_type} />
        </div>
        <div className="flex gap-2 pr-12">
          <DeleteButton />
          <Button asChild variant="outline" className="h-9">
            <Link to={`/deals/${deal.id}/show`}>
              {translate("resources.deals.action.back_to_deal")}
            </Link>
          </Button>
        </div>
      </div>
    </DialogTitle>
  );
}

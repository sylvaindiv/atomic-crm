import { SaveButton } from "@/components/admin/form";
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  CreateBase,
  Form,
  useNotify,
  useRedirect,
  useResourceContext,
  useTranslate,
  type CreateBaseProps,
  type FormProps,
} from "ra-core";
import { type ReactNode } from "react";
import { useWatch } from "react-hook-form";
import { cn } from "@/lib/utils";

export interface CreateSheetProps extends CreateBaseProps {
  /**
   * The children elements that will be rendered inside the sheet as form inputs
   */
  children: ReactNode;

  /**
   * Controls whether the sheet is open
   */
  open: boolean;

  /**
   * Callback fired when the sheet open state changes
   */
  onOpenChange: (open: boolean) => void;

  /**
   * The title displayed in the sheet header
   */
  title?: ReactNode;

  /**
   * Default values for the form
   */
  defaultValues?: FormProps["defaultValues"];

  /**
   * Optional actions to render in the sheet header, next to the title
   */
  headerActions?: ReactNode;

  /**
   * Evaluated against the live form values on every change; while it returns
   * true, the Save button stays disabled. Use it to make an in-progress
   * required selection (e.g. a modal contact picker) structurally block
   * submission, instead of only surfacing after a failed submit attempt.
   */
  disableSaveWhen?: (values: Record<string, unknown>) => boolean;
}

/**
 * A Sheet component that contains a create form with externally controlled open state.
 *
 * Renders a Sheet containing a CreateBase form. The sheet has a fixed footer with Save and Close buttons.
 * The open state is controlled externally via the open and onOpenChange props. The sheet will automatically
 * close itself on successful submission (if redirect is false) or when the Close button is clicked.
 *
 * @example
 * ```tsx
 * const [open, setOpen] = useState(false);
 *
 * return (
 *   <>
 *     <Button onClick={() => setOpen(true)}>Create Contact</Button>
 *     <CreateSheet
 *       resource="contacts"
 *       title="Create Contact"
 *       open={open}
 *       onOpenChange={setOpen}
 *     >
 *       <TextInput source="first_name" />
 *       <TextInput source="last_name" />
 *       <TextInput source="email" />
 *     </CreateSheet>
 *   </>
 * );
 * ```
 */
export const CreateSheet = ({
  children,
  open,
  onOpenChange,
  title = "Create",
  redirect: redirectTo = "show",
  mutationOptions,
  defaultValues,
  headerActions,
  disableSaveWhen,
  ...createBaseProps
}: CreateSheetProps) => {
  const resource = useResourceContext(createBaseProps);
  const translate = useTranslate();
  const notify = useNotify();
  const redirect = useRedirect();

  // Handle success - close sheet in addition to default behavior
  const handleSuccess = (...args: any[]) => {
    if (mutationOptions?.onSuccess) {
      return mutationOptions.onSuccess(
        ...(args as Parameters<typeof mutationOptions.onSuccess>),
      );
    }
    const [data] = args;
    notify(`resources.${resource}.notifications.created`, {
      type: "info",
      messageArgs: {
        smart_count: 1,
        _: translate(`ra.notification.created`, {
          smart_count: 1,
        }),
      },
      undoable: createBaseProps.mutationMode === "undoable",
    });
    redirect(redirectTo, resource, data.id, data);
    onOpenChange(false);
  };

  const enhancedMutationOptions = {
    ...mutationOptions,
    onSuccess: handleSuccess,
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="h-dvh flex flex-col"
        aria-describedby={undefined}
      >
        <CreateBase
          {...createBaseProps}
          redirect={redirectTo}
          mutationOptions={enhancedMutationOptions}
        >
          <Form
            defaultValues={defaultValues}
            className="h-dvh flex-1 flex flex-col"
          >
            <SheetHeader className="border-b">
              <div
                className={cn(
                  "flex items-center gap-2",
                  headerActions && "pr-12",
                )}
              >
                <SheetTitle className="min-w-0 flex-1 truncate">
                  {typeof title === "string" ? (
                    <span className="text-xl font-semibold">{title}</span>
                  ) : (
                    title
                  )}
                </SheetTitle>
                {headerActions && (
                  <div className="shrink-0">{headerActions}</div>
                )}
              </div>
            </SheetHeader>

            <div className="flex-1 overflow-y-auto flex flex-col gap-3 p-4">
              {children}
            </div>

            <SheetFooter className="border-t flex flex-row w-full gap-4">
              <GuardedSaveButton disableSaveWhen={disableSaveWhen} />
            </SheetFooter>
          </Form>
        </CreateBase>
      </SheetContent>
    </Sheet>
  );
};

/**
 * Renders the sheet's Save button, disabled while `disableSaveWhen` reports
 * the current form values as incomplete. Watching the whole form (rather than
 * a single field) keeps this generic across every CreateSheet consumer.
 */
const GuardedSaveButton = ({
  disableSaveWhen,
}: {
  disableSaveWhen?: (values: Record<string, unknown>) => boolean;
}) => {
  const values = useWatch();
  const disabled = disableSaveWhen ? disableSaveWhen(values) : false;

  return <SaveButton className="flex-1 h-12" disabled={disabled} />;
};

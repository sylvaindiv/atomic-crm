import { ShowBase } from "ra-core";
import { useSearchParams } from "react-router";
import { Sheet, SheetContent } from "@/components/ui/sheet";

import { ContactShowContent } from "./ContactShow";

export const ContactShowSheet = ({
  open,
  id,
}: {
  open: boolean;
  id?: string;
}) => {
  const [, setSearchParams] = useSearchParams();

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        next.delete("show");
        return next;
      });
    }
  };

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-4xl lg:max-w-6xl overflow-y-auto p-6"
        aria-describedby={undefined}
      >
        {id ? (
          <ShowBase id={id}>
            <ContactShowContent />
          </ShowBase>
        ) : null}
      </SheetContent>
    </Sheet>
  );
};

import { useState } from "react";
import { useRecordContext } from "ra-core";
import { InfiniteListBase } from "ra-core";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";

import type { Contact } from "../../types";
import { NoteCreate, NotesIterator } from "../../notes";

export const LatestNoteCell = () => {
  const record = useRecordContext<Contact>();
  const [open, setOpen] = useState(false);

  if (!record) return null;

  const latestText = record.latest_note_text;

  return (
    <div onClick={(event) => event.stopPropagation()}>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title={latestText || undefined}
        className="block w-full max-w-[200px] truncate rounded px-2 py-1 text-left hover:bg-accent aria-[expanded=true]:bg-accent"
      >
        {latestText || "\u2014"}
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[80vh] overflow-y-auto sm:max-w-2xl">
          <DialogTitle>
            {record.first_name} {record.last_name}
          </DialogTitle>
          {open && (
            <InfiniteListBase
              resource="contact_notes"
              filter={{ contact_id: record.id }}
              sort={{ field: "date", order: "DESC" }}
              perPage={25}
              disableSyncWithLocation
              storeKey={false}
              empty={
                <NoteCreate reference="contacts" showStatus className="mt-4" />
              }
            >
              <NotesIterator reference="contacts" showStatus />
            </InfiniteListBase>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

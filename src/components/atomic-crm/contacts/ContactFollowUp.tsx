import { useState } from "react";
import {
  RecordContextProvider,
  ResourceContextProvider,
  useGetList,
  useTranslate,
} from "ra-core";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

import type { Contact, ContactNote, Task as TaskRecord } from "../types";
import { Note } from "../notes/Note";
import { NoteCreate } from "../notes/NoteCreate";
import { Task } from "../tasks/Task";
import { AddTask } from "../tasks/AddTask";
import { TaskCreateSheet } from "../tasks/TaskCreateSheet";
import { resourceForContact } from "./contactResource";

const PAGE_SIZE = 25;

export const ContactFollowUp = ({
  contact,
  mobile = false,
  onCreateNote,
}: {
  contact: Contact;
  mobile?: boolean;
  onCreateNote?: () => void;
}) => {
  const translate = useTranslate();
  const [openLimit, setOpenLimit] = useState(PAGE_SIZE);
  const [historyLimit, setHistoryLimit] = useState(PAGE_SIZE);
  const [taskCreateOpen, setTaskCreateOpen] = useState(false);
  const openTasks = useGetList<TaskRecord>("tasks", {
    pagination: { page: 1, perPage: openLimit },
    sort: { field: "due_date", order: "ASC" },
    filter: { contact_id: contact.id, "done_date@is": null },
  });
  const notes = useGetList<ContactNote>("contact_notes", {
    pagination: { page: 1, perPage: historyLimit },
    sort: { field: "date", order: "DESC" },
    filter: { contact_id: contact.id },
  });
  const completedTasks = useGetList<TaskRecord>("tasks", {
    pagination: { page: 1, perPage: historyLimit },
    sort: { field: "done_date", order: "DESC" },
    filter: { contact_id: contact.id, "done_date@not.is": null },
  });

  const history = [
    ...(notes.data ?? []).map((note) => ({
      kind: "note" as const,
      record: note,
      date: note.date,
    })),
    ...(completedTasks.data ?? []).map((task) => ({
      kind: "task" as const,
      record: task,
      date: task.done_date ?? "",
    })),
  ]
    .sort((a, b) => Date.parse(b.date) - Date.parse(a.date))
    .slice(0, historyLimit);
  const hasMoreHistory =
    (notes.total ?? 0) > historyLimit ||
    (completedTasks.total ?? 0) > historyLimit;

  return (
    <div className="space-y-6">
      <section>
        <h3 className="mb-3 text-lg font-semibold">
          {translate("crm.follow_up.open_tasks")}
        </h3>
        {mobile ? (
          <>
            <TaskCreateSheet
              open={taskCreateOpen}
              onOpenChange={setTaskCreateOpen}
              contact_id={contact.id}
            />
            <Button
              type="button"
              variant="outline"
              className="mb-3"
              onClick={() => setTaskCreateOpen(true)}
            >
              {translate("resources.tasks.action.add")}
            </Button>
          </>
        ) : (
          <RecordContextProvider value={contact}>
            <AddTask />
          </RecordContextProvider>
        )}
        {openTasks.data?.length ? (
          <div className="space-y-3">
            {openTasks.data.map((task) => (
              <ResourceContextProvider key={task.id} value="tasks">
                <RecordContextProvider value={task}>
                  <Task task={task} />
                </RecordContextProvider>
              </ResourceContextProvider>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            {translate("crm.follow_up.no_open_tasks")}
          </p>
        )}
        {(openTasks.total ?? 0) > openLimit && (
          <Button
            type="button"
            variant="ghost"
            onClick={() => setOpenLimit((limit) => limit + PAGE_SIZE)}
          >
            {translate("crm.follow_up.load_more")}
          </Button>
        )}
      </section>

      <section>
        <h3 className="mb-3 text-lg font-semibold">
          {translate("resources.notes.name", { smart_count: 2 })}
        </h3>
        {mobile ? (
          <Button type="button" variant="outline" onClick={onCreateNote}>
            {translate("resources.notes.action.add")}
          </Button>
        ) : (
          <RecordContextProvider value={contact}>
            <NoteCreate reference={resourceForContact(contact)} showStatus />
          </RecordContextProvider>
        )}
      </section>

      <section>
        <h3 className="mb-3 text-lg font-semibold">
          {translate("crm.follow_up.history")}
        </h3>
        {!history.length ? (
          <p className="text-sm text-muted-foreground">
            {translate("crm.follow_up.empty_history")}
          </p>
        ) : (
          <ResourceContextProvider value="contact_notes">
            <div className="space-y-4">
              {history.map((item, index) => (
                <div key={`${item.kind}-${item.record.id}`}>
                  {item.kind === "note" ? (
                    <Note
                      note={item.record}
                      isLast={index === history.length - 1}
                      showStatus
                    />
                  ) : (
                    <ResourceContextProvider value="tasks">
                      <RecordContextProvider value={item.record}>
                        <Task task={item.record} />
                      </RecordContextProvider>
                    </ResourceContextProvider>
                  )}
                  {index < history.length - 1 && <Separator />}
                </div>
              ))}
            </div>
          </ResourceContextProvider>
        )}
        {hasMoreHistory && (
          <Button
            type="button"
            variant="ghost"
            onClick={() => setHistoryLimit((limit) => limit + PAGE_SIZE)}
          >
            {translate("crm.follow_up.load_more")}
          </Button>
        )}
      </section>
    </div>
  );
};

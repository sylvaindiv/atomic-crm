import {
  RecordContextProvider,
  ResourceContextProvider,
  useDataProvider,
  type DataProvider,
} from "ra-core";
import { render } from "vitest-browser-react";
import { StoryWrapper, buildContact, createCrmDb } from "@/test/StoryWrapper";
import type { Task as TaskRecord } from "../types";
import { Task } from "./Task";

const mockIsMobile = vi.hoisted(() => vi.fn(() => true));
vi.mock("@/hooks/use-mobile", () => ({
  useIsMobile: mockIsMobile,
}));

describe("Task", () => {
  it("shows bare deadlines without a time or timezone shift and keeps timed deadlines", async () => {
    const base = {
      id: 7,
      contact_id: 1,
      type: "none",
      text: "Suivi",
      due_date: "2026-10-25",
      done_date: null,
      sales_id: 0,
    };
    const screen = await render(
      <StoryWrapper>
        <ResourceContextProvider value="tasks">
          <Task task={base} />
          <Task
            task={{
              ...base,
              id: 8,
              due_date: "2026-10-25T12:30:00.000Z",
              text: "Ancienne échéance",
            }}
          />
        </ResourceContextProvider>
      </StoryWrapper>,
    );
    await expect
      .element(screen.getByText("10/25/2026", { exact: true }))
      .toBeVisible();
    await expect
      .element(
        screen.getByText(
          new Date("2026-10-25T12:30:00.000Z").toLocaleString(),
          { exact: true },
        ),
      )
      .toBeVisible();
  });

  it("completes a mobile task with one update", async () => {
    mockIsMobile.mockReturnValue(true);
    const contact = buildContact({ id: 1 });
    const task: TaskRecord = {
      id: 7,
      contact_id: 1,
      type: "none",
      text: "Appeler le club",
      due_date: "2026-10-02",
      done_date: null,
      sales_id: 0,
    };
    let dataProvider: DataProvider | undefined;
    const DataProviderListener = () => {
      dataProvider = useDataProvider();
      return null;
    };

    const screen = await render(
      <StoryWrapper data={createCrmDb({ contacts: [contact], tasks: [task] })}>
        <DataProviderListener />
        <ResourceContextProvider value="tasks">
          <RecordContextProvider value={task}>
            <Task task={task} />
          </RecordContextProvider>
        </ResourceContextProvider>
      </StoryWrapper>,
    );

    await expect.poll(() => dataProvider !== undefined).toBe(true);
    const spy = vi.spyOn(dataProvider!, "update");
    await screen.getByRole("checkbox").click();
    await expect.poll(() => spy.mock.calls.length).toBe(1);
  });
});

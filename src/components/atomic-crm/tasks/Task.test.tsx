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

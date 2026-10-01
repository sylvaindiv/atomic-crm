import { render } from "vitest-browser-react";
import { vi } from "vitest";

import { StoryWrapper, buildContact, createCrmDb } from "@/test/StoryWrapper";
import { createDataProvider } from "../providers/fakerest";
import { ClientsPage } from "./ClientsPage";

const contacts = [
  buildContact({ id: 1, first_name: "Client", status: "client" }),
  buildContact({ id: 2, first_name: "Prospect", status: "a_recontacter" }),
];

const ClientsStory = ({
  dataProvider,
}: {
  dataProvider?: ReturnType<typeof createDataProvider>;
}) => (
  <StoryWrapper data={createCrmDb({ contacts })} dataProvider={dataProvider}>
    <ClientsPage />
  </StoryWrapper>
);

describe("ClientsPage", () => {
  it("shows only clients and saves checklist changes", async () => {
    const dataProvider = createDataProvider({
      db: createCrmDb({ contacts }),
      silent: true,
    });
    const screen = await render(<ClientsStory dataProvider={dataProvider} />);

    await expect.element(screen.getByText("Client Lovelace")).toBeVisible();
    await expect
      .element(screen.getByText("Prospect Lovelace"))
      .not.toBeInTheDocument();
    await expect.element(screen.getByText(/0 \/ 4/)).toBeVisible();

    const item = screen.getByRole("checkbox", {
      name: "Premier tournoi créé ensemble",
    });
    await item.click();
    await expect.element(item).toBeChecked();
    await expect.element(screen.getByText(/1 \/ 4/)).toBeVisible();

    await vi.waitFor(async () => {
      const { data } = await dataProvider.getOne("contacts", { id: 1 });
      expect(data.client_checklist).toEqual(["first-tournament"]);
    });

    screen.unmount();
    const reopened = await render(<ClientsStory dataProvider={dataProvider} />);
    const savedItem = reopened.getByRole("checkbox", {
      name: "Premier tournoi créé ensemble",
    });
    await expect.element(savedItem).toBeChecked();
    await expect.element(reopened.getByText(/1 \/ 4/)).toBeVisible();

    await savedItem.click();
    await expect.element(savedItem).not.toBeChecked();
    await vi.waitFor(async () => {
      const { data } = await dataProvider.getOne("contacts", { id: 1 });
      expect(data.client_checklist).toEqual([]);
    });
  });
});

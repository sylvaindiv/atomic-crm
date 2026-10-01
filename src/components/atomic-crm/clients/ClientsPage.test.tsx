import { render } from "vitest-browser-react";

import { StoryWrapper, buildContact, createCrmDb } from "@/test/StoryWrapper";
import { ClientsPage } from "./ClientsPage";

const ClientsStory = () => (
  <StoryWrapper
    data={createCrmDb({
      contacts: [
        buildContact({ id: 1, first_name: "Client", status: "client" }),
        buildContact({
          id: 2,
          first_name: "Prospect",
          status: "a_recontacter",
        }),
      ],
    })}
  >
    <ClientsPage />
  </StoryWrapper>
);

describe("ClientsPage", () => {
  it("shows only clients and saves checklist changes", async () => {
    const screen = await render(<ClientsStory />);

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
  });
});

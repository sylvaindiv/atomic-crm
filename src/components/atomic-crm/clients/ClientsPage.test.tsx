import { render } from "vitest-browser-react";
import { vi } from "vitest";

import { StoryWrapper, buildContact, createCrmDb } from "@/test/StoryWrapper";
import type { Company } from "../types";
import { createDataProvider } from "../providers/fakerest";
import { ClientsPage } from "./ClientsPage";

const contacts = [buildContact({ id: 1, first_name: "Referee" })];
const companies = [
  { id: 20, name: "Club Client", is_client: true, client_checklist: [] },
  { id: 21, name: "Club Second", is_client: true, client_checklist: [] },
] as unknown as Company[];
const clubReferees = [
  { id: 1, company_id: 20, contact_id: 1, client_checklist: [] },
  {
    id: 2,
    company_id: 21,
    contact_id: 1,
    client_checklist: ["first-tournament"],
  },
];

const ClientsStory = ({
  dataProvider,
}: {
  dataProvider?: ReturnType<typeof createDataProvider>;
}) => (
  <StoryWrapper
    data={createCrmDb({ contacts, companies, club_referees: clubReferees })}
    dataProvider={dataProvider}
  >
    <ClientsPage />
  </StoryWrapper>
);

describe("ClientsPage", () => {
  it("offers a retry when the client list fails to load", async () => {
    const dataProvider = createDataProvider({
      db: createCrmDb({ contacts, companies, club_referees: clubReferees }),
      silent: true,
    });
    const getList = vi
      .spyOn(dataProvider, "getList")
      .mockRejectedValue(new Error("Network unavailable"));
    const screen = await render(<ClientsStory dataProvider={dataProvider} />);

    await expect.element(screen.getByRole("alert")).toBeVisible();
    const retry = screen.getByRole("button", { name: "Réessayer" });
    await expect.element(retry).toBeVisible();
    await retry.click();
    await vi.waitFor(() => expect(getList).toHaveBeenCalledTimes(2));
  });

  it("shows client clubs and saves independent club and referee progress", async () => {
    const dataProvider = createDataProvider({
      db: createCrmDb({ contacts, companies, club_referees: clubReferees }),
      silent: true,
    });
    const screen = await render(<ClientsStory dataProvider={dataProvider} />);

    await expect
      .element(screen.getByRole("link", { name: "Edit steps" }))
      .toHaveAttribute("href", "/settings/clients");
    await expect.element(screen.getByText("Club Client")).toBeVisible();
    await expect.element(screen.getByText("Referee Lovelace")).toBeVisible();

    const item = screen.getByRole("checkbox", {
      name: "Compte Stripe connecté",
    });
    await item.click();
    await expect.element(item).toBeChecked();
    await expect.element(screen.getByText(/1\/2/)).toBeVisible();

    await vi.waitFor(async () => {
      const { data } = await dataProvider.getOne("companies", { id: 20 });
      expect(data.client_checklist).toEqual(["stripe-connected"]);
    });

    screen.unmount();
    const reopened = await render(<ClientsStory dataProvider={dataProvider} />);
    const savedItem = reopened.getByRole("checkbox", {
      name: "Compte Stripe connecté",
    });
    await expect.element(savedItem).toBeChecked();
    await expect.element(reopened.getByText(/1\/2/)).toBeVisible();

    await savedItem.click();
    await expect.element(savedItem).not.toBeChecked();
    await vi.waitFor(async () => {
      const { data } = await dataProvider.getOne("companies", { id: 20 });
      expect(data.client_checklist).toEqual([]);
    });

    const refereeItem = reopened.getByRole("checkbox", {
      name: "Extension MOJA installée",
    });
    await refereeItem.click();
    await vi.waitFor(async () => {
      const { data } = await dataProvider.getOne("club_referees", { id: 1 });
      expect(data.client_checklist).toEqual(["mouja-installed"]);
    });
    const secondProgress = await dataProvider.getOne("club_referees", {
      id: 2,
    });
    expect(secondProgress.data.client_checklist).toEqual(["first-tournament"]);
    await reopened.getByRole("button", { name: "Déplier le club" }).click();
    await expect.element(reopened.getByText("Club Second")).toBeVisible();
    const sameStep = reopened.getByRole("checkbox", {
      name: "Premier tournoi créé ensemble",
    });
    await expect.element(sameStep.nth(0)).not.toBeChecked();
    await expect.element(sameStep.nth(1)).toBeChecked();
    const clubAfterRefereeChange = await dataProvider.getOne("companies", {
      id: 20,
    });
    expect(clubAfterRefereeChange.data.client_checklist).toEqual([]);
  });
});

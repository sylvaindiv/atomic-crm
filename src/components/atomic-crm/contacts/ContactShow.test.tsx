import {
  ResourceContextProvider,
  ShowBase,
  useDataProvider,
  type DataProvider,
} from "ra-core";
import { render } from "vitest-browser-react";
import { buildContact, StoryWrapper } from "@/test/StoryWrapper";
import type { Deal } from "../types";
import { ContactAside } from "./ContactAside";
import { MobileSuccess } from "./ContactShow.mobile.stories";

const buildLinkedDeal = (overrides: Partial<Deal> = {}): Deal => ({
  id: 42,
  name: "Padel Masters vs Riviera Open",
  company_id: 1,
  contact_ids: [],
  category: "other",
  case_type: "judge",
  stage: "won",
  description: "",
  amount: 0,
  created_at: "2025-01-01T09:00:00.000Z",
  updated_at: "2025-01-01T09:00:00.000Z",
  expected_closing_date: "2025-02-01",
  sales_id: 0,
  index: 0,
  ...overrides,
});

const mockIsMobile = vi.hoisted(() => vi.fn(() => true));
vi.mock("@/hooks/use-mobile", () => ({
  useIsMobile: mockIsMobile,
}));

describe("ContactShow", () => {
  beforeEach(() => {
    mockIsMobile.mockReturnValue(true);
  });

  it("renders a safe zero-task label before nb_tasks is available", async () => {
    const screen = await render(<MobileSuccess />);

    await expect
      .element(screen.getByRole("tab", { name: "0 tasks" }))
      .toBeVisible();
    await expect
      .poll(
        () => screen.container.textContent?.includes("%{smart_count}") ?? false,
      )
      .toBe(false);
    await expect
      .poll(() => screen.container.textContent?.includes("||||") ?? false)
      .toBe(false);
  });

  it("updates the contact status from the aside", async () => {
    mockIsMobile.mockReturnValue(false);

    let dataProvider: DataProvider | null = null;
    const contact = buildContact({ status: "a_recontacter" });

    const DataProviderListener = () => {
      dataProvider = useDataProvider();
      return null;
    };

    const screen = await render(
      <StoryWrapper data={{ contacts: [contact] }}>
        <DataProviderListener />
        <ResourceContextProvider value="contacts">
          <ShowBase id={contact.id}>
            <ContactAside />
          </ShowBase>
        </ResourceContextProvider>
      </StoryWrapper>,
    );

    await expect
      .element(screen.getByRole("combobox"))
      .toHaveTextContent("A recontacter");

    await screen.getByRole("combobox").click();
    await screen.getByRole("option", { name: /visio/i }).click();

    await expect
      .poll(async () => {
        const { data } = await dataProvider!.getOne("contacts", {
          id: contact.id,
        });
        return data.status;
      })
      .toBe("visio");

    await expect
      .element(screen.getByRole("combobox"))
      .toHaveTextContent("Visio");
  });

  it("shows the linked deal with a link to it when the contact has one", async () => {
    mockIsMobile.mockReturnValue(false);

    const deal = buildLinkedDeal();
    const contact = buildContact({ linked_deal_id: deal.id });

    const screen = await render(
      <StoryWrapper data={{ contacts: [contact], deals: [deal] }}>
        <ResourceContextProvider value="contacts">
          <ShowBase id={contact.id}>
            <ContactAside />
          </ShowBase>
        </ResourceContextProvider>
      </StoryWrapper>,
    );

    await expect.element(screen.getByText("Linked deal")).toBeVisible();
    await expect.element(screen.getByText(deal.name)).toBeVisible();
    await expect.element(screen.getByText("Won")).toBeVisible();
    await expect
      .element(screen.getByRole("link", { name: new RegExp(deal.name) }))
      .toHaveAttribute("href", `/deals/${deal.id}/show`);
  });

  it("renders no linked deal section when the contact has none", async () => {
    mockIsMobile.mockReturnValue(false);

    const contact = buildContact({ linked_deal_id: null });

    const screen = await render(
      <StoryWrapper data={{ contacts: [contact], deals: [] }}>
        <ResourceContextProvider value="contacts">
          <ShowBase id={contact.id}>
            <ContactAside />
          </ShowBase>
        </ResourceContextProvider>
      </StoryWrapper>,
    );

    // The aside still renders fully (no broken reference, no stuck loader).
    await expect.element(screen.getByRole("combobox")).toBeVisible();
    expect(screen.container.textContent?.includes("Linked deal")).toBe(false);
  });
});

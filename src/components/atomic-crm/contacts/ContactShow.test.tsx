import {
  ResourceContextProvider,
  ShowBase,
  useDataProvider,
  type DataProvider,
} from "ra-core";
import { render } from "vitest-browser-react";
import { buildContact, StoryWrapper } from "@/test/StoryWrapper";
import { ContactAside } from "./ContactAside";
import { MobileSuccess } from "./ContactShow.mobile.stories";

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

  it("shows the case amount and description when the contact has them", async () => {
    mockIsMobile.mockReturnValue(false);

    const contact = buildContact({
      amount: 500,
      description: "Padel Masters vs Riviera Open",
    });

    const screen = await render(
      <StoryWrapper data={{ contacts: [contact] }}>
        <ResourceContextProvider value="contacts">
          <ShowBase id={contact.id}>
            <ContactAside />
          </ShowBase>
        </ResourceContextProvider>
      </StoryWrapper>,
    );

    await expect.element(screen.getByText("Case info")).toBeVisible();
    await expect.element(screen.getByText("$500")).toBeVisible();
    await expect
      .element(screen.getByText("Padel Masters vs Riviera Open"))
      .toBeVisible();
  });

  it("shows the amount placeholder and no description row when the contact has neither", async () => {
    mockIsMobile.mockReturnValue(false);

    const contact = buildContact({ amount: null, description: undefined });

    const screen = await render(
      <StoryWrapper data={{ contacts: [contact] }}>
        <ResourceContextProvider value="contacts">
          <ShowBase id={contact.id}>
            <ContactAside />
          </ShowBase>
        </ResourceContextProvider>
      </StoryWrapper>,
    );

    // The amount row always renders, with the shared en-dash placeholder.
    await expect.element(screen.getByText("Case info")).toBeVisible();
    await expect.element(screen.getByText("–")).toBeVisible();
    expect(screen.container.textContent?.includes("Case description")).toBe(
      false,
    );
  });
});

import { render } from "vitest-browser-react";

import { buildContact, StoryWrapper } from "@/test/StoryWrapper";
import { useContactImport, type ContactImportSchema } from "./useContactImport";

// Builds one CSV row, matching what usePapaParse hands processBatch once
// dynamicTyping is off (every value is a string, see usePapaParse.tsx).
const buildRow = (
  overrides: Partial<ContactImportSchema> = {},
): ContactImportSchema => ({
  first_name: "Ada",
  last_name: "Lovelace",
  gender: "female",
  title: "",
  company: "",
  zipcode: "",
  city: "",
  email_work: "",
  email_home: "",
  email_other: "",
  phone_work: "",
  phone_home: "",
  phone_other: "",
  background: "",
  avatar: "",
  first_seen: "",
  last_seen: "",
  has_newsletter: "false",
  status: "a_recontacter",
  tags: "",
  linkedin_url: "",
  known_via: "",
  comment: "",
  comment_2: "",
  ...overrides,
});

// A minimal harness: useContactImport is a hook with no UI of its own, so we
// expose processBatch behind a button click and assert on the (mocked)
// dataProvider calls it makes.
const ImportHarness = ({ batch }: { batch: ContactImportSchema[] }) => {
  const processBatch = useContactImport();
  return (
    <button type="button" onClick={() => processBatch(batch)}>
      Run import
    </button>
  );
};

// Loosely typed on purpose: DataProvider.getList/create are generic in
// RecordType, which a concrete per-test mock (e.g. returning Contact[])
// can't satisfy structurally. Mirrors the `params: any` convention already
// used for mocks in ContactCreate.test.tsx, scoped to this one adaptation
// point instead of casting in every test.
type MockDataProvider = {
  create: (resource: string, params: any) => Promise<{ data: any }>;
  getList: (
    resource: string,
    params?: any,
  ) => Promise<{ data: any[]; total: number }>;
};

const renderHarness = (
  batch: ContactImportSchema[],
  dataProvider: MockDataProvider,
) =>
  render(
    <StoryWrapper dataProvider={dataProvider as any}>
      <ImportHarness batch={batch} />
    </StoryWrapper>,
  );

describe("useContactImport", () => {
  it("creates a new company with zipcode/city from the row, preserving leading zeros in the postal code", async () => {
    // Arrange
    const createMock = vi.fn(async (_resource: string, params: any) => ({
      data: { id: 1, ...params.data },
    }));
    const getListMock = vi.fn(async () => ({ data: [], total: 0 }));
    const screen = await renderHarness(
      [buildRow({ company: "Acme", zipcode: "01120", city: "Montluel" })],
      { create: createMock, getList: getListMock },
    );

    // Act
    await screen.getByRole("button", { name: "Run import" }).click();

    // Assert
    await expect
      .poll(
        () =>
          createMock.mock.calls.filter(([resource]) => resource === "companies")
            .length,
      )
      .toBe(1);
    expect(createMock).toHaveBeenCalledWith(
      "companies",
      expect.objectContaining({
        data: expect.objectContaining({
          name: "Acme",
          // Not 1120: a numeric coercion here would silently corrupt
          // French postal codes in departments 01/02/07/08/09.
          zipcode: "01120",
          city: "Montluel",
        }),
      }),
    );
  });

  it("resolves known_via to referred_by_id via a case-insensitive name match", async () => {
    // Arrange
    const createMock = vi.fn(async (_resource: string, params: any) => ({
      data: { id: 1, ...params.data },
    }));
    const getListMock = vi.fn(async (resource: string) => {
      if (resource === "contacts") {
        return {
          data: [
            buildContact({ id: 7, first_name: "Grace", last_name: "Hopper" }),
          ],
          total: 1,
        };
      }
      return { data: [], total: 0 };
    });
    const screen = await renderHarness(
      [buildRow({ known_via: "grace hopper" })],
      { create: createMock, getList: getListMock },
    );

    // Act
    await screen.getByRole("button", { name: "Run import" }).click();

    // Assert
    await expect
      .poll(
        () =>
          createMock.mock.calls.filter(([resource]) => resource === "contacts")
            .length,
      )
      .toBe(1);
    expect(createMock).toHaveBeenCalledWith(
      "contacts",
      expect.objectContaining({
        data: expect.objectContaining({
          referred_by_id: 7,
          // dynamicTyping is off, so this also guards the has_newsletter
          // string->boolean coercion ("false" must not be treated as truthy).
          has_newsletter: false,
        }),
      }),
    );
  });

  it("leaves referred_by_id unset when known_via matches no existing contact", async () => {
    // Arrange
    const createMock = vi.fn(async (_resource: string, params: any) => ({
      data: { id: 1, ...params.data },
    }));
    const getListMock = vi.fn(async () => ({ data: [], total: 0 }));
    const screen = await renderHarness(
      [buildRow({ known_via: "Nobody Nowhere" })],
      { create: createMock, getList: getListMock },
    );

    // Act
    await screen.getByRole("button", { name: "Run import" }).click();

    // Assert
    await expect
      .poll(
        () =>
          createMock.mock.calls.filter(([resource]) => resource === "contacts")
            .length,
      )
      .toBe(1);
    expect(createMock).toHaveBeenCalledWith(
      "contacts",
      expect.objectContaining({
        data: expect.objectContaining({ referred_by_id: undefined }),
      }),
    );
  });

  it("creates a contact_notes row for each non-empty comment/comment_2", async () => {
    // Arrange
    const createMock = vi.fn(async (resource: string, params: any) => ({
      data: { id: resource === "contacts" ? 55 : 1, ...params.data },
    }));
    const getListMock = vi.fn(async () => ({ data: [], total: 0 }));
    const screen = await renderHarness(
      [buildRow({ comment: "Loves tea", comment_2: "Prefers mornings" })],
      { create: createMock, getList: getListMock },
    );

    // Act
    await screen.getByRole("button", { name: "Run import" }).click();

    // Assert
    await expect
      .poll(
        () =>
          createMock.mock.calls.filter(
            ([resource]) => resource === "contact_notes",
          ).length,
      )
      .toBe(2);
    expect(createMock).toHaveBeenCalledWith(
      "contact_notes",
      expect.objectContaining({
        data: expect.objectContaining({ contact_id: 55, text: "Loves tea" }),
      }),
    );
    expect(createMock).toHaveBeenCalledWith(
      "contact_notes",
      expect.objectContaining({
        data: expect.objectContaining({
          contact_id: 55,
          text: "Prefers mornings",
        }),
      }),
    );
  });

  it("does not create any contact_notes rows when comment and comment_2 are empty", async () => {
    // Arrange
    const createMock = vi.fn(async (_resource: string, params: any) => ({
      data: { id: 1, ...params.data },
    }));
    const getListMock = vi.fn(async () => ({ data: [], total: 0 }));
    const screen = await renderHarness([buildRow()], {
      create: createMock,
      getList: getListMock,
    });

    // Act
    await screen.getByRole("button", { name: "Run import" }).click();
    // Wait for the contact create (which precedes any notes creation) before
    // asserting the negative -- polling directly on the negative condition
    // would pass prematurely, before processBatch has had a chance to run.
    await expect
      .poll(
        () =>
          createMock.mock.calls.filter(([resource]) => resource === "contacts")
            .length,
      )
      .toBe(1);

    // Assert
    expect(
      createMock.mock.calls.some(([resource]) => resource === "contact_notes"),
    ).toBe(false);
  });
});

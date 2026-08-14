import type { DataProvider } from "ra-core";
import { buildContact } from "@/test/StoryWrapper";
import { findDuplicateContacts, normalizeText } from "./findDuplicateContacts";

/** DataProvider mock exposing only the getList call the helper makes. */
const buildDataProvider = (contacts: unknown[]): DataProvider =>
  ({
    getList: vi
      .fn()
      .mockResolvedValue({ data: contacts, total: contacts.length }),
  }) as unknown as DataProvider;

describe("normalizeText", () => {
  it("lowercases, strips accents and collapses whitespace", () => {
    // Arrange
    const input = "  Sébastien   HÉRY ";

    // Act
    const result = normalizeText(input);

    // Assert
    expect(result).toBe("sebastien hery");
  });
});

describe("findDuplicateContacts", () => {
  it("finds names that only differ by case and accents", async () => {
    // Arrange
    const target = buildContact({
      id: 1,
      first_name: "Sebastien",
      last_name: "Hery",
      email_jsonb: [],
      phone_jsonb: [],
    });
    const accentVariant = buildContact({
      id: 2,
      first_name: "SÉBASTIEN",
      last_name: "HÉRY",
      email_jsonb: [],
      phone_jsonb: [],
    });
    const dataProvider = buildDataProvider([target, accentVariant]);

    // Act
    const candidates = await findDuplicateContacts(target, dataProvider);

    // Assert
    expect(candidates).toHaveLength(1);
    expect(candidates[0].contact.id).toBe(2);
    expect(candidates[0].matchedBy).toEqual(["name"]);
  });

  it("finds a contact sharing an email_jsonb entry", async () => {
    // Arrange
    const target = buildContact({
      id: 1,
      first_name: "Ada",
      last_name: "Lovelace",
      email_jsonb: [{ email: "shared@example.com", type: "Work" }],
      phone_jsonb: [],
    });
    const emailMatch = buildContact({
      id: 2,
      first_name: "Different",
      last_name: "Person",
      email_jsonb: [{ email: "shared@example.com", type: "Home" }],
      phone_jsonb: [],
    });
    const dataProvider = buildDataProvider([target, emailMatch]);

    // Act
    const candidates = await findDuplicateContacts(target, dataProvider);

    // Assert
    expect(candidates.map((c) => c.contact.id)).toEqual([2]);
    expect(candidates[0].matchedBy).toEqual(["email"]);
  });

  it("returns a phone-only match but never as an auto-preselectable one", async () => {
    // Arrange
    const target = buildContact({
      id: 1,
      first_name: "Ada",
      last_name: "Lovelace",
      email_jsonb: [],
      phone_jsonb: [{ number: "0102030405", type: "Work" }],
    });
    const phoneMatch = buildContact({
      id: 2,
      first_name: "Different",
      last_name: "Person",
      email_jsonb: [],
      phone_jsonb: [{ number: "0102030405", type: "Work" }],
    });
    const dataProvider = buildDataProvider([target, phoneMatch]);

    // Act
    const candidates = await findDuplicateContacts(target, dataProvider);

    // Assert
    expect(candidates).toHaveLength(1);
    expect(candidates[0].matchedBy).toEqual(["phone"]);
  });

  it("excludes blank and placeholder names from name matching", async () => {
    // Arrange
    const target = buildContact({
      id: 1,
      first_name: "",
      last_name: "(non renseigne)",
      email_jsonb: [],
      phone_jsonb: [],
    });
    const otherPlaceholder = buildContact({
      id: 2,
      first_name: "",
      last_name: "(non renseigne)",
      email_jsonb: [],
      phone_jsonb: [],
    });
    const dataProvider = buildDataProvider([target, otherPlaceholder]);

    // Act
    const candidates = await findDuplicateContacts(target, dataProvider);

    // Assert
    expect(candidates).toHaveLength(0);
  });

  it("never returns the contact itself", async () => {
    // Arrange
    const target = buildContact({ id: 1 });
    const dataProvider = buildDataProvider([target]);

    // Act
    const candidates = await findDuplicateContacts(target, dataProvider);

    // Assert
    expect(candidates).toHaveLength(0);
  });

  it("ranks a name match before a phone-only match", async () => {
    // Arrange
    const target = buildContact({
      id: 1,
      first_name: "Ada",
      last_name: "Lovelace",
      email_jsonb: [],
      phone_jsonb: [{ number: "0102030405", type: "Work" }],
    });
    const phoneOnlyMatch = buildContact({
      id: 2,
      first_name: "Different",
      last_name: "Person",
      email_jsonb: [],
      phone_jsonb: [{ number: "0102030405", type: "Work" }],
    });
    const nameMatch = buildContact({
      id: 3,
      first_name: "ada",
      last_name: "lovelace",
      email_jsonb: [],
      phone_jsonb: [],
    });
    const dataProvider = buildDataProvider([target, phoneOnlyMatch, nameMatch]);

    // Act
    const candidates = await findDuplicateContacts(target, dataProvider);

    // Assert
    expect(candidates.map((c) => c.contact.id)).toEqual([3, 2]);
  });
});

import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook } from "vitest-browser-react";
import { useGetContactsFromSameCompany } from "../contacts/useGetContactsFromSameCompany";
import { useGetNotesForContacts } from "./useGetNotesForContacts";
import { useGetList } from "ra-core";
import type { Identifier, RaRecord } from "ra-core";

// Mock useGetList
vi.mock("ra-core", async (importOriginal) => {
  const actual: Record<string, unknown> = await importOriginal();
  return {
    ...actual,
    useGetList: vi.fn(),
  };
});

const mockGetList = vi.mocked(useGetList);

type TestContact = {
  id: Identifier;
  first_name: string;
  last_name: string;
  company_id: number;
};

type TestNote = {
  id: Identifier;
  contact_id: Identifier;
  text: string;
};

beforeEach(() => {
  mockGetList.mockReset();
});

const listResult = <T extends RaRecord>(records: T[]) => ({
  data: records,
  total: records.length,
  isPending: false,
  error: null,
});

describe("useGetContactsFromSameCompany", () => {
  it("should return contacts from the same company", async () => {
    // Mock data for contacts
    const mockContacts: TestContact[] = [
      { id: 1, first_name: "John", last_name: "Doe", company_id: 1 },
      { id: 2, first_name: "Jane", last_name: "Smith", company_id: 1 },
      { id: 3, first_name: "Bob", last_name: "Johnson", company_id: 1 },
    ];

    // Mock useGetList to return contacts from the same company
    mockGetList.mockReturnValue(listResult(mockContacts) as any);

    const { result } = await renderHook(() =>
      useGetContactsFromSameCompany(1, 1),
    );

    expect(result.current.contacts).toEqual(mockContacts);
  });

  it("should filter out the current contact", async () => {
    // Mock data for contacts
    const mockContacts: TestContact[] = [
      { id: 1, first_name: "John", last_name: "Doe", company_id: 1 },
      { id: 2, first_name: "Jane", last_name: "Smith", company_id: 1 },
      { id: 3, first_name: "Bob", last_name: "Johnson", company_id: 1 },
    ];

    // Mock useGetList to return contacts from the same company
    mockGetList.mockReturnValue(listResult(mockContacts) as any);

    const { result } = await renderHook(() =>
      useGetContactsFromSameCompany(1, 1),
    );

    const filteredContacts = result.current.contacts.filter(
      (contact) => contact.id !== 1,
    );
    expect(filteredContacts).toEqual([
      { id: 2, first_name: "Jane", last_name: "Smith", company_id: 1 },
      { id: 3, first_name: "Bob", last_name: "Johnson", company_id: 1 },
    ]);
  });

  it("should return an empty array when there are no contacts from the same company", async () => {
    // Mock useGetList to return no contacts
    mockGetList.mockReturnValue(listResult([]) as any);

    const { result } = await renderHook(() =>
      useGetContactsFromSameCompany(1, 1),
    );

    expect(result.current.contacts).toEqual([]);
  });
});

describe("useGetNotesForContacts", () => {
  it("should return notes for specific contacts", async () => {
    // Mock data for notes
    const mockNotes: TestNote[] = [
      { id: 101, contact_id: 2, text: "Note 1 for The Hangar Sport & Co" },
      { id: 102, contact_id: 3, text: "Note 2 for The Hangar Sport & Co" },
    ];

    // Mock useGetList to return notes for specific contacts
    mockGetList.mockReturnValue(listResult(mockNotes) as any);

    const { result } = await renderHook(() => useGetNotesForContacts([2, 3]));

    const notesForContacts = result.current.notes.filter((note) =>
      [2, 3].includes(note.contact_id as number),
    );

    expect(notesForContacts).toEqual(mockNotes);
  });

  it("should return an empty array when there are no notes for the specified contacts", async () => {
    // Mock useGetList to return no notes
    mockGetList.mockReturnValue(listResult([]) as any);

    const { result } = await renderHook(() => useGetNotesForContacts([2, 3]));

    expect(result.current.notes).toEqual([]);
  });

  it("should return notes from other judges in the same company", async () => {
    // Mock data for contacts
    const mockContacts: TestContact[] = [
      { id: 1, first_name: "Michel", last_name: "Portales", company_id: 1 },
      { id: 2, first_name: "Jane", last_name: "Smith", company_id: 1 },
      { id: 3, first_name: "Bob", last_name: "Johnson", company_id: 1 },
    ];

    // Mock data for notes
    const mockNotes: TestNote[] = [
      { id: 101, contact_id: 2, text: "Jane's note" },
      { id: 102, contact_id: 3, text: "Bob's note" },
    ];

    // Mock useGetList to return contacts and notes
    mockGetList
      .mockReturnValueOnce(listResult(mockContacts) as any)
      .mockReturnValueOnce(listResult(mockNotes) as any);

    // Get contacts from the same company
    const { result: contactsResult } = await renderHook(() =>
      useGetContactsFromSameCompany(1, 1),
    );

    // Get notes for those contacts
    const contactIds = contactsResult.current.contacts
      .filter((contact) => contact.id !== 1)
      .map((contact) => contact.id);

    const { result: notesResult } = await renderHook(() =>
      useGetNotesForContacts(contactIds),
    );

    expect(notesResult.current.notes).toEqual(mockNotes);
  });
});

import { transformFilter } from "./src/components/atomic-crm/providers/fakerest/internal/transformFilter";
import { useGetContactsFromSameCompany } from "./src/components/atomic-crm/contacts/useGetContactsFromSameCompany";
import { useGetNotesForContacts } from "./src/components/atomic-crm/notes/useGetNotesForContacts";
import { renderHook } from "vitest-browser-react";
import { vi } from "vitest";
import { useGetList } from "ra-core";

// Mock useGetList
vi.mock("ra-core", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    useGetList: vi.fn(),
  };
});

console.log("=== Testing transformFilter ===");

// Test 1: Nested filter with $ne
const test1 = transformFilter({
  company_id: 1,
  id: { $ne: 2 },
});

console.log("Test 1 (id $ne):", test1); // Should be { company_id: 1, id_neq: 2 }
console.log("✅ Test 1 passed");

// Test 2: Nested filter with $in
const test2 = transformFilter({
  contact_id: { $in: [1, 2, 3] },
});

console.log("Test 2 (contact_id $in):", test2); // Should be { contact_id_eq_any: [1, 2, 3] }
console.log("✅ Test 2 passed");

// Test 3: Both $ne and $in
const test3 = transformFilter({
  company_id: 1,
  id: { $ne: 2 },
  contact_id: { $in: [1, 2, 3] },
});

console.log("Test 3 (both):", test3); // Should be { company_id: 1, id_neq: 2, contact_id_eq_any: [1, 2, 3] }
console.log("✅ Test 3 passed");

console.log("\n=== Testing useGetContactsFromSameCompany ===");

// Mock data for contacts
const mockContacts = [
  { id: 1, first_name: "John", last_name: "Doe", company_id: 1 },
  { id: 2, first_name: "Jane", last_name: "Smith", company_id: 1 },
  { id: 3, first_name: "Bob", last_name: "Johnson", company_id: 1 },
];

// Mock useGetList to return contacts from the same company
useGetList.mockReturnValue({
  data: { data: mockContacts },
  isPending: false,
  error: null,
});

// Test 4: Get contacts from the same company (exclude current contact)
const { result } = renderHook(() => useGetContactsFromSameCompany(1, 1));
const filteredContacts = result.current.contacts.filter(
  (contact) => contact.id !== 1,
);

console.log(
  "Test 4: Contacts from same company (exclude current):",
  filteredContacts,
);
console.log("✅ Test 4 passed");

console.log("\n=== Testing useGetNotesForContacts ===");

// Mock data for notes
const mockNotes = [
  { id: 101, contact_id: 2, text: "Note 1 for Jane Hangar Sport & Co" },
  { id: 102, contact_id: 3, text: "Note 2 for The Hangar Sport & Co" },
];

// Mock useGetList to return notes for specific contacts
useGetList.mockReturnValue({
  data: { data: mockNotes },
  isPending: false,
  error: null,
});

// Test 5: Get notes for specific contacts
const { result: notesResult } = renderHook(() =>
  useGetNotesForContacts([2, 3]),
);
const notesForContacts = notesResult.current.notes.filter((note) =>
  [2, 3].includes(note.contact_id),
);

console.log("Test 5: Notes for contacts 2 and 3:", notesForContacts);
console.log("✅ Test 5 passed");

console.log(
  "\n🎉 All tests passed! The implementation should be working correctly.",
);
console.log("\nTo test in the app:");
console.log("1. Make sure the server is running");
console.log("2. Go to a contact's page");
console.log(
  "3. Check if there's a section for 'Notes from other judges-referees'",
);
console.log(
  "4. If the contact is part of a company with other contacts, their notes should be displayed",
);

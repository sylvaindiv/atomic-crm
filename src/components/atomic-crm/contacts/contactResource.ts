import { useLocation } from "react-router";

export type ContactResource = "contacts" | "partners";

export const resourceForContact = (contact: {
  contact_type?: string;
}): ContactResource =>
  contact.contact_type === "partner" ? "partners" : "contacts";

// Sheets can be opened outside a ResourceContext (mobile navigation).
export const useContactResource = (): ContactResource =>
  useLocation().pathname.startsWith("/partners") ? "partners" : "contacts";

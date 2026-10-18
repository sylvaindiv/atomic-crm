import type {
  Company,
  Contact,
  ContactNote,
  Sale,
  Tag,
  Task,
} from "../../../types";
import type { ConfigurationContextValue } from "../../../root/ConfigurationContext";

export interface Db {
  companies: Company[];
  club_referees: Array<{
    id: number;
    company_id: number;
    contact_id: number;
    client_checklist: string[];
  }>;
  contacts: Contact[];
  contact_notes: ContactNote[];
  sales: Sale[];
  tags: Tag[];
  tasks: Task[];
  configuration: Array<{ id: number; config: ConfigurationContextValue }>;
}

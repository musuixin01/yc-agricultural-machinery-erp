export const PARTY_ROLES = ["CUSTOMER", "SUPPLIER"] as const;
export const PARTY_STATUSES = ["ACTIVE", "INACTIVE"] as const;
export type PartyRoleType = (typeof PARTY_ROLES)[number];
export type PartyStatus = (typeof PARTY_STATUSES)[number];
export interface PartyView {
  id: string;
  code: string;
  name: string;
  shortName: string | null;
  mnemonicCode: string | null;
  taxId: string | null;
  identityNumberMasked: string | null;
  hasPortrait: boolean;
  roles: PartyRoleType[];
  creditLimit: string;
  paymentTermsDays: number;
  paymentTermsMonths: number;
  province: string | null;
  city: string | null;
  address: string | null;
  notes: string | null;
  contacts: {
    id: string;
    name: string;
    phone: string | null;
    email: string | null;
    position: string | null;
    isPrimary: boolean;
  }[];
  status: PartyStatus;
  version: number;
  createdAt: string;
  updatedAt: string;
}
export interface PartyPage {
  items: PartyView[];
  page: number;
  pageSize: number;
  total: number;
}

import type { CreatePartyDto } from "./dto/create-party.dto.js";
import type { QueryPartiesDto } from "./dto/query-parties.dto.js";
import type { PartyPage, PartyStatus, PartyView } from "./parties.types.js";
export const PARTIES_REPOSITORY = Symbol("PARTIES_REPOSITORY");
export interface PartiesRepository {
  list(query: QueryPartiesDto): Promise<PartyPage>;
  findById(id: string): Promise<PartyView | null>;
  create(input: CreatePartyDto): Promise<PartyView>;
  updateStatus(
    id: string,
    status: PartyStatus,
    version: number,
  ): Promise<PartyView | null>;
}

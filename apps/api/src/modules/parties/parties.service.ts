import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma } from "../../generated/prisma/client.js";
import type { CreatePartyDto } from "./dto/create-party.dto.js";
import type { QueryPartiesDto } from "./dto/query-parties.dto.js";
import type { UpdatePartyStatusDto } from "./dto/update-party-status.dto.js";
import {
  PARTIES_REPOSITORY,
  type PartiesRepository,
} from "./parties.repository.js";
@Injectable()
export class PartiesService {
  constructor(
    @Inject(PARTIES_REPOSITORY) private readonly repository: PartiesRepository,
  ) {}
  list(query: QueryPartiesDto) {
    return this.repository.list(query);
  }
  async get(id: string) {
    const party = await this.repository.findById(id);
    if (!party)
      throw new NotFoundException({
        code: "PARTY_NOT_FOUND",
        detail: "客户或供应商不存在。",
      });
    return party;
  }
  async create(input: CreatePartyDto) {
    try {
      return await this.repository.create(input);
    } catch (error: unknown) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      )
        throw new ConflictException({
          code: "PARTY_DUPLICATE",
          detail: "往来单位编码、税号、身份证号或主要联系人设置重复。",
        });
      throw error;
    }
  }
  async updateStatus(id: string, input: UpdatePartyStatusDto) {
    const updated = await this.repository.updateStatus(
      id,
      input.status,
      input.version,
    );
    if (updated) return updated;
    const exists = await this.repository.findById(id);
    if (!exists)
      throw new NotFoundException({
        code: "PARTY_NOT_FOUND",
        detail: "客户或供应商不存在。",
      });
    throw new ConflictException({
      code: "PARTY_VERSION_CONFLICT",
      detail: "往来单位已被其他人修改，请刷新后重试。",
      currentVersion: exists.version,
    });
  }
}

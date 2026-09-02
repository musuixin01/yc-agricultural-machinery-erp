import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma } from "../../generated/prisma/client.js";
import type { CreateWarehouseDto } from "./dto/create-warehouse.dto.js";
import type { QueryWarehousesDto } from "./dto/query-warehouses.dto.js";
import type { SetDefaultWarehouseDto } from "./dto/set-default-warehouse.dto.js";
import type { UpdateWarehouseStatusDto } from "./dto/update-warehouse-status.dto.js";
import {
  WAREHOUSES_REPOSITORY,
  type WarehousesRepository,
} from "./warehouses.repository.js";

@Injectable()
export class WarehousesService {
  constructor(
    @Inject(WAREHOUSES_REPOSITORY)
    private readonly repository: WarehousesRepository,
  ) {}

  list(query: QueryWarehousesDto) {
    return this.repository.list(query);
  }

  async get(id: string) {
    const warehouse = await this.repository.findById(id);
    if (!warehouse) {
      throw new NotFoundException({
        code: "WAREHOUSE_NOT_FOUND",
        detail: "仓库不存在。",
      });
    }
    return warehouse;
  }

  async create(input: CreateWarehouseDto) {
    try {
      return await this.repository.create(input);
    } catch (error: unknown) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        throw new ConflictException({
          code: "WAREHOUSE_DUPLICATE",
          detail: "仓库编码、名称或库位编码已经存在。",
        });
      }
      throw error;
    }
  }

  async updateStatus(id: string, input: UpdateWarehouseStatusDto) {
    const current = await this.get(id);
    if (current.isDefault && input.status === "INACTIVE") {
      throw new BadRequestException({
        code: "WAREHOUSE_DEFAULT_CANNOT_DISABLE",
        detail: "默认仓库不能停用，请先将其他仓库设为默认。",
      });
    }
    const updated = await this.repository.updateStatus(
      id,
      input.status,
      input.version,
    );
    if (updated) return updated;
    throw new ConflictException({
      code: "WAREHOUSE_VERSION_CONFLICT",
      detail: "仓库已被其他人修改，请刷新后重试。",
      currentVersion: (await this.get(id)).version,
    });
  }

  async setDefault(id: string, input: SetDefaultWarehouseDto) {
    const updated = await this.repository.setDefault(id, input.version);
    if (updated) return updated;
    const current = await this.repository.findById(id);
    if (!current) {
      throw new NotFoundException({
        code: "WAREHOUSE_NOT_FOUND",
        detail: "仓库不存在。",
      });
    }
    if (current.status !== "ACTIVE") {
      throw new BadRequestException({
        code: "WAREHOUSE_INACTIVE_CANNOT_DEFAULT",
        detail: "已停用仓库不能设为默认仓库。",
      });
    }
    throw new ConflictException({
      code: "WAREHOUSE_VERSION_CONFLICT",
      detail: "仓库已被其他人修改，请刷新后重试。",
      currentVersion: current.version,
    });
  }
}

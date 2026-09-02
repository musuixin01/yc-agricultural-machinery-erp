import { Inject, Injectable } from "@nestjs/common";
import type { Prisma } from "../../generated/prisma/client.js";
import { PrismaService } from "../../infrastructure/prisma/prisma.service.js";
import type { CreateWarehouseDto } from "./dto/create-warehouse.dto.js";
import type { QueryWarehousesDto } from "./dto/query-warehouses.dto.js";
import type { WarehousesRepository } from "./warehouses.repository.js";
import type {
  WarehousePage,
  WarehouseStatus,
  WarehouseView,
} from "./warehouses.types.js";

const warehouseInclude = {
  locations: {
    orderBy: [{ status: "asc" as const }, { code: "asc" as const }],
  },
} satisfies Prisma.WarehouseInclude;
type WarehouseRecord = Prisma.WarehouseGetPayload<{
  include: typeof warehouseInclude;
}>;

function toView(warehouse: WarehouseRecord): WarehouseView {
  return {
    id: warehouse.id,
    code: warehouse.code,
    name: warehouse.name,
    address: warehouse.address,
    notes: warehouse.notes,
    isDefault: warehouse.isDefault,
    status: warehouse.status as WarehouseStatus,
    version: warehouse.version,
    locations: warehouse.locations.map((location) => ({
      id: location.id,
      code: location.code,
      name: location.name,
      description: location.description,
      status: location.status as WarehouseStatus,
    })),
    createdAt: warehouse.createdAt.toISOString(),
    updatedAt: warehouse.updatedAt.toISOString(),
  };
}

@Injectable()
export class PrismaWarehousesRepository implements WarehousesRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async list(query: QueryWarehousesDto): Promise<WarehousePage> {
    const search = query.search?.trim();
    const where: Prisma.WarehouseWhereInput = {
      status: query.status,
      ...(search
        ? {
            OR: [
              { code: { contains: search, mode: "insensitive" } },
              { name: { contains: search, mode: "insensitive" } },
              { address: { contains: search, mode: "insensitive" } },
              {
                locations: {
                  some: { name: { contains: search, mode: "insensitive" } },
                },
              },
            ],
          }
        : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.warehouse.findMany({
        where,
        include: warehouseInclude,
        orderBy: [{ isDefault: "desc" }, { status: "asc" }, { name: "asc" }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.warehouse.count({ where }),
    ]);
    return {
      items: items.map(toView),
      page: query.page,
      pageSize: query.pageSize,
      total,
    };
  }

  async findById(id: string) {
    const item = await this.prisma.warehouse.findUnique({
      where: { id },
      include: warehouseInclude,
    });
    return item ? toView(item) : null;
  }

  async create(input: CreateWarehouseDto) {
    const item = await this.prisma.$transaction(async (transaction) => {
      if (input.isDefault) {
        await transaction.warehouse.updateMany({
          where: { isDefault: true },
          data: { isDefault: false, version: { increment: 1 } },
        });
      }
      return transaction.warehouse.create({
        data: {
          code: input.code,
          name: input.name,
          address: input.address,
          notes: input.notes,
          isDefault: input.isDefault ?? false,
          locations: input.locations?.length
            ? { create: input.locations }
            : undefined,
        },
        include: warehouseInclude,
      });
    });
    return toView(item);
  }

  async updateStatus(id: string, status: WarehouseStatus, version: number) {
    const result = await this.prisma.warehouse.updateMany({
      where: { id, version },
      data: { status, version: { increment: 1 } },
    });
    return result.count === 1 ? this.findById(id) : null;
  }

  async setDefault(id: string, version: number) {
    const result = await this.prisma.$transaction(async (transaction) => {
      const target = await transaction.warehouse.findUnique({ where: { id } });
      if (!target || target.version !== version || target.status !== "ACTIVE") {
        return null;
      }
      await transaction.warehouse.updateMany({
        where: { isDefault: true, id: { not: id } },
        data: { isDefault: false, version: { increment: 1 } },
      });
      return transaction.warehouse.update({
        where: { id },
        data: { isDefault: true, version: { increment: 1 } },
        include: warehouseInclude,
      });
    });
    return result ? toView(result) : null;
  }
}

import { Inject, Injectable } from "@nestjs/common";
import type { Prisma } from "../../generated/prisma/client.js";
import { PrismaService } from "../../infrastructure/prisma/prisma.service.js";
import type { CreateProductDto } from "./dto/create-product.dto.js";
import type { QueryProductsDto } from "./dto/query-products.dto.js";
import type {
  CatalogRepository,
  ProductUpdateResult,
} from "./catalog.repository.js";
import type { UpdateProductDto } from "./dto/update-product.dto.js";
import type {
  ProductPage,
  ProductStatus,
  ProductType,
  ProductView,
} from "./catalog.types.js";

const productInclude = {
  category: true,
  brand: true,
  baseUnit: true,
  barcodes: {
    orderBy: [{ isPrimary: "desc" as const }, { barcode: "asc" as const }],
  },
} satisfies Prisma.ProductInclude;
type ProductRecord = Prisma.ProductGetPayload<{
  include: typeof productInclude;
}>;

function toView(product: ProductRecord): ProductView {
  return {
    id: product.id,
    code: product.code,
    name: product.name,
    mnemonicCode: product.mnemonicCode,
    type: product.type as ProductType,
    model: product.model,
    specification: product.specification,
    category: {
      id: product.category.id,
      code: product.category.code,
      name: product.category.name,
    },
    brand: product.brand
      ? {
          id: product.brand.id,
          code: product.brand.code,
          name: product.brand.name,
        }
      : null,
    baseUnit: {
      id: product.baseUnit.id,
      code: product.baseUnit.code,
      name: product.baseUnit.name,
      decimalScale: product.baseUnit.decimalScale,
    },
    retailPrice: product.retailPrice.toFixed(4),
    wholesalePrice: product.wholesalePrice.toFixed(4),
    defaultPurchasePrice: product.defaultPurchasePrice.toFixed(4),
    minimumSalePrice: product.minimumSalePrice.toFixed(4),
    safetyStock: product.safetyStock.toFixed(6),
    barcodes: product.barcodes.map((x) => ({
      id: x.id,
      barcode: x.barcode,
      isPrimary: x.isPrimary,
    })),
    attributes: product.attributes as Record<string, unknown>,
    status: product.status as ProductStatus,
    version: product.version,
    createdAt: product.createdAt.toISOString(),
    updatedAt: product.updatedAt.toISOString(),
  };
}

@Injectable()
export class PrismaCatalogRepository implements CatalogRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async list(query: QueryProductsDto): Promise<ProductPage> {
    const search = query.search?.trim();
    const where: Prisma.ProductWhereInput = {
      categoryId: query.categoryId,
      type: query.type,
      status: query.status,
      ...(search
        ? {
            OR: [
              { code: { contains: search, mode: "insensitive" } },
              { name: { contains: search, mode: "insensitive" } },
              { mnemonicCode: { contains: search, mode: "insensitive" } },
              { model: { contains: search, mode: "insensitive" } },
              { barcodes: { some: { barcode: { contains: search } } } },
            ],
          }
        : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.product.findMany({
        where,
        include: productInclude,
        orderBy: [{ status: "asc" }, { updatedAt: "desc" }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.product.count({ where }),
    ]);
    return {
      items: items.map(toView),
      page: query.page,
      pageSize: query.pageSize,
      total,
    };
  }

  async findById(id: string) {
    const item = await this.prisma.product.findUnique({
      where: { id },
      include: productInclude,
    });
    return item ? toView(item) : null;
  }

  async create(input: CreateProductDto) {
    const primaryCount = input.barcodes?.filter((x) => x.isPrimary).length ?? 0;
    const item = await this.prisma.product.create({
      data: {
        code: input.code,
        name: input.name,
        mnemonicCode: input.mnemonicCode,
        type: input.type,
        model: input.model,
        specification: input.specification,
        categoryId: input.categoryId,
        brandId: input.brandId,
        baseUnitId: input.baseUnitId,
        retailPrice: input.retailPrice ?? "0",
        wholesalePrice: input.wholesalePrice ?? "0",
        defaultPurchasePrice: input.defaultPurchasePrice ?? "0",
        minimumSalePrice: input.minimumSalePrice ?? "0",
        safetyStock: input.safetyStock ?? "0",
        attributes: (input.attributes ?? {}) as Prisma.InputJsonValue,
        barcodes: input.barcodes?.length
          ? {
              create: input.barcodes.map((x, index) => ({
                barcode: x.barcode,
                isPrimary: primaryCount ? Boolean(x.isPrimary) : index === 0,
              })),
            }
          : undefined,
      },
      include: productInclude,
    });
    return toView(item);
  }

  async update(
    id: string,
    input: UpdateProductDto,
  ): Promise<ProductUpdateResult> {
    return this.prisma.$transaction(async (transaction) => {
      const current = await transaction.product.findUnique({
        where: { id },
        select: { id: true, version: true, baseUnitId: true },
      });
      if (!current) return "NOT_FOUND";
      if (current.version !== input.version) return "VERSION_CONFLICT";
      if (current.baseUnitId !== input.baseUnitId) {
        const [inventoryCount, purchaseCount, salesCount] = await Promise.all([
          transaction.inventoryLedgerEntry.count({ where: { productId: id } }),
          transaction.purchaseLine.count({ where: { productId: id } }),
          transaction.salesLine.count({ where: { productId: id } }),
        ]);
        if (inventoryCount + purchaseCount + salesCount > 0)
          return "BASE_UNIT_LOCKED";
      }
      const updated = await transaction.product.updateMany({
        where: { id, version: input.version },
        data: {
          code: input.code,
          name: input.name,
          mnemonicCode: input.mnemonicCode || null,
          type: input.type,
          model: input.model || null,
          specification: input.specification || null,
          categoryId: input.categoryId,
          brandId: input.brandId || null,
          baseUnitId: input.baseUnitId,
          retailPrice: input.retailPrice ?? "0",
          wholesalePrice: input.wholesalePrice ?? "0",
          defaultPurchasePrice: input.defaultPurchasePrice ?? "0",
          minimumSalePrice: input.minimumSalePrice ?? "0",
          safetyStock: input.safetyStock ?? "0",
          attributes:
            input.attributes === undefined
              ? undefined
              : (input.attributes as Prisma.InputJsonValue),
          version: { increment: 1 },
        },
      });
      if (updated.count !== 1) return "VERSION_CONFLICT";
      await transaction.productBarcode.deleteMany({ where: { productId: id } });
      if (input.barcodes?.length) {
        const primaryCount = input.barcodes.filter((x) => x.isPrimary).length;
        await transaction.productBarcode.createMany({
          data: input.barcodes.map((barcode, index) => ({
            productId: id,
            barcode: barcode.barcode,
            isPrimary: primaryCount ? Boolean(barcode.isPrimary) : index === 0,
          })),
        });
      }
      const product = await transaction.product.findUniqueOrThrow({
        where: { id },
        include: productInclude,
      });
      return toView(product);
    });
  }

  async updateStatus(
    id: string,
    status: ProductStatus,
    expectedVersion: number,
  ) {
    const result = await this.prisma.product.updateMany({
      where: { id, version: expectedVersion },
      data: { status, version: { increment: 1 } },
    });
    return result.count === 1 ? this.findById(id) : null;
  }

  async references() {
    const [categories, brands, units] = await Promise.all([
      this.prisma.productCategory.findMany({
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
        select: { id: true, code: true, name: true },
      }),
      this.prisma.brand.findMany({
        orderBy: { name: "asc" },
        select: { id: true, code: true, name: true },
      }),
      this.prisma.unit.findMany({
        orderBy: { name: "asc" },
        select: { id: true, code: true, name: true, decimalScale: true },
      }),
    ]);
    return { categories, brands, units };
  }
}

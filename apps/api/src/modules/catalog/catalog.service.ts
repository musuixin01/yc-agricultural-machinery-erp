import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma } from "../../generated/prisma/client.js";
import {
  CATALOG_REPOSITORY,
  type CatalogRepository,
} from "./catalog.repository.js";
import type { CreateProductDto } from "./dto/create-product.dto.js";
import type { QueryProductsDto } from "./dto/query-products.dto.js";
import type { UpdateProductStatusDto } from "./dto/update-product-status.dto.js";

@Injectable()
export class CatalogService {
  constructor(
    @Inject(CATALOG_REPOSITORY) private readonly repository: CatalogRepository,
  ) {}

  list(query: QueryProductsDto) {
    return this.repository.list(query);
  }
  references() {
    return this.repository.references();
  }

  async get(id: string) {
    const product = await this.repository.findById(id);
    if (!product)
      throw new NotFoundException({
        code: "CATALOG_PRODUCT_NOT_FOUND",
        detail: "商品不存在或已被移除。",
      });
    return product;
  }

  async create(input: CreateProductDto) {
    try {
      return await this.repository.create(input);
    } catch (error: unknown) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        throw new ConflictException({
          code: "CATALOG_DUPLICATE",
          detail: "商品编码或条码已存在。",
        });
      }
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2003"
      ) {
        throw new ConflictException({
          code: "CATALOG_REFERENCE_INVALID",
          detail: "分类、品牌或单位不存在。",
        });
      }
      throw error;
    }
  }

  async updateStatus(id: string, input: UpdateProductStatusDto) {
    const updated = await this.repository.updateStatus(
      id,
      input.status,
      input.version,
    );
    if (updated) return updated;
    const exists = await this.repository.findById(id);
    if (!exists)
      throw new NotFoundException({
        code: "CATALOG_PRODUCT_NOT_FOUND",
        detail: "商品不存在。",
      });
    throw new ConflictException({
      code: "CATALOG_VERSION_CONFLICT",
      detail: "商品已被其他人修改，请刷新后重试。",
      currentVersion: exists.version,
    });
  }
}

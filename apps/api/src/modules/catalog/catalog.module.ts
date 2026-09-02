import { Module } from "@nestjs/common";
import { CatalogController } from "./catalog.controller.js";
import { CATALOG_REPOSITORY } from "./catalog.repository.js";
import { CatalogService } from "./catalog.service.js";
import { PrismaCatalogRepository } from "./prisma-catalog.repository.js";

@Module({
  controllers: [CatalogController],
  providers: [
    CatalogService,
    { provide: CATALOG_REPOSITORY, useClass: PrismaCatalogRepository },
  ],
})
export class CatalogModule {}

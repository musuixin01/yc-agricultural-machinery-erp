import { Module } from "@nestjs/common";
import { PrismaWarehousesRepository } from "./prisma-warehouses.repository.js";
import { WarehousesController } from "./warehouses.controller.js";
import { WAREHOUSES_REPOSITORY } from "./warehouses.repository.js";
import { WarehousesService } from "./warehouses.service.js";

@Module({
  controllers: [WarehousesController],
  providers: [
    WarehousesService,
    {
      provide: WAREHOUSES_REPOSITORY,
      useClass: PrismaWarehousesRepository,
    },
  ],
  exports: [WarehousesService],
})
export class WarehousesModule {}

import { Module } from "@nestjs/common";
import { InventoryController } from "./inventory.controller.js";
import { InventoryService } from "./inventory.service.js";
import { InventoryDamageService } from "./inventory-damage.service.js";
import { StocktakeService } from "./stocktake.service.js";

@Module({
  controllers: [InventoryController],
  providers: [InventoryService, StocktakeService, InventoryDamageService],
  exports: [InventoryService, StocktakeService, InventoryDamageService],
})
export class InventoryModule {}

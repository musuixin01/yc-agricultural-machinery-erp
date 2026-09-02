import { Module } from "@nestjs/common";
import { PurchasingController } from "./purchasing.controller.js";
import { PurchasingService } from "./purchasing.service.js";
import { PurchaseReturnsService } from "./purchase-returns.service.js";

@Module({
  controllers: [PurchasingController],
  providers: [PurchasingService, PurchaseReturnsService],
})
export class PurchasingModule {}

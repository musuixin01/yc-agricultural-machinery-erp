import { Module } from "@nestjs/common";
import { SalesController } from "./sales.controller.js";
import { SalesService } from "./sales.service.js";
import { SalesReturnsService } from "./sales-returns.service.js";
import { SalesReversalsService } from "./sales-reversals.service.js";

@Module({
  controllers: [SalesController],
  providers: [SalesService, SalesReturnsService, SalesReversalsService],
})
export class SalesModule {}

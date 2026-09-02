import { Module } from "@nestjs/common";
import { CashController } from "./cash.controller.js";
import { CashTransfersService } from "./cash-transfers.service.js";

@Module({
  controllers: [CashController],
  providers: [CashTransfersService],
})
export class CashModule {}

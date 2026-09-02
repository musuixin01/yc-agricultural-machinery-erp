import { Module } from "@nestjs/common";
import { ReceivablesController } from "./receivables.controller.js";
import { ReceivablesService } from "./receivables.service.js";
import { ReceiptReversalsService } from "./receipt-reversals.service.js";
import { CustomerAdvancesService } from "./customer-advances.service.js";
import { CustomerStatementsService } from "./customer-statements.service.js";

@Module({
  controllers: [ReceivablesController],
  providers: [
    ReceivablesService,
    ReceiptReversalsService,
    CustomerAdvancesService,
    CustomerStatementsService,
  ],
})
export class ReceivablesModule {}

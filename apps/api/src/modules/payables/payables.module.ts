import { Module } from "@nestjs/common";
import { PayablesController } from "./payables.controller.js";
import { PayablesService } from "./payables.service.js";
import { PaymentReversalsService } from "./payment-reversals.service.js";
import { SupplierAdvancesService } from "./supplier-advances.service.js";
import { SupplierStatementsService } from "./supplier-statements.service.js";

@Module({
  controllers: [PayablesController],
  providers: [
    PayablesService,
    PaymentReversalsService,
    SupplierAdvancesService,
    SupplierStatementsService,
  ],
})
export class PayablesModule {}

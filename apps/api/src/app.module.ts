import { Module } from "@nestjs/common";
import { CatalogModule } from "./modules/catalog/catalog.module.js";
import { HealthController } from "./health.controller.js";
import { PrismaModule } from "./infrastructure/prisma/prisma.module.js";
import { PartiesModule } from "./modules/parties/parties.module.js";
import { WarehousesModule } from "./modules/warehouses/warehouses.module.js";
import { IdentityModule } from "./modules/identity/identity.module.js";
import { InventoryModule } from "./modules/inventory/inventory.module.js";
import { PurchasingModule } from "./modules/purchasing/purchasing.module.js";
import { PayablesModule } from "./modules/payables/payables.module.js";
import { ReceivablesModule } from "./modules/receivables/receivables.module.js";
import { SalesModule } from "./modules/sales/sales.module.js";
import { CashModule } from "./modules/cash/cash.module.js";
import { ReportingModule } from "./modules/reporting/reporting.module.js";
import { AdministrationModule } from "./modules/administration/administration.module.js";

@Module({
  imports: [
    PrismaModule,
    IdentityModule,
    CatalogModule,
    PartiesModule,
    WarehousesModule,
    InventoryModule,
    PurchasingModule,
    PayablesModule,
    ReceivablesModule,
    SalesModule,
    CashModule,
    ReportingModule,
    AdministrationModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}

import { Global, Module } from "@nestjs/common";
import { APP_INTERCEPTOR } from "@nestjs/core";
import { AuditInterceptor } from "./audit.interceptor.js";
import { AuthenticationGuard } from "./authentication.guard.js";
import { IdentityController } from "./identity.controller.js";
import { IdentityAdminController } from "./identity-admin.controller.js";
import { IdentityService } from "./identity.service.js";
import { PermissionsGuard } from "./permissions.guard.js";

@Global()
@Module({
  controllers: [IdentityController, IdentityAdminController],
  providers: [
    IdentityService,
    AuthenticationGuard,
    PermissionsGuard,
    { provide: APP_INTERCEPTOR, useClass: AuditInterceptor },
  ],
  exports: [IdentityService, AuthenticationGuard, PermissionsGuard],
})
export class IdentityModule {}

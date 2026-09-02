import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from "@nestjs/common";
import { catchError, from, mergeMap, throwError } from "rxjs";
import type { AuthenticatedUser } from "./authenticated-user.js";
import { IdentityService } from "./identity.service.js";

type AuditedRequest = {
  method: string;
  originalUrl: string;
  ip?: string;
  params?: { id?: string };
  user?: AuthenticatedUser;
};

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(private readonly identity: IdentityService) {}

  intercept(context: ExecutionContext, next: CallHandler) {
    const request = context.switchToHttp().getRequest<AuditedRequest>();
    if (
      !request.user ||
      !["POST", "PATCH", "PUT", "DELETE"].includes(request.method) ||
      request.originalUrl.startsWith("/api/v1/auth/") ||
      /^\/api\/v1\/inventory\/opening-documents\/[^/]+\/post(?:\?|$)/.test(
        request.originalUrl,
      ) ||
      /^\/api\/v1\/purchasing\/receipts\/[^/]+\/post(?:\?|$)/.test(
        request.originalUrl,
      ) ||
      /^\/api\/v1\/payables\/payments\/[^/]+\/post(?:\?|$)/.test(
        request.originalUrl,
      ) ||
      /^\/api\/v1\/sales\/documents\/[^/]+\/post(?:\?|$)/.test(
        request.originalUrl,
      ) ||
      (request.method === "POST" &&
        request.originalUrl.startsWith("/api/v1/payables/cash-accounts"))
    ) {
      return next.handle();
    }
    const route = request.originalUrl.split("?")[0];
    const action = `${request.method} ${route.replace(/[0-9a-f]{8}-[0-9a-f-]{27,}/gi, ":id")}`;
    const entityType = route.split("/").filter(Boolean)[2] ?? "unknown";
    const record = (result: "SUCCESS" | "FAILURE", entityId?: string) =>
      this.identity.recordAudit({
        actorUserId: request.user!.id,
        action,
        entityType,
        entityId: entityId ?? request.params?.id,
        result,
        ipAddress: request.ip,
        metadata: { route },
      });
    return next.handle().pipe(
      mergeMap((value: unknown) =>
        from(record("SUCCESS", this.entityId(value))).pipe(
          mergeMap(() => [value]),
        ),
      ),
      catchError((error: unknown) =>
        from(record("FAILURE")).pipe(mergeMap(() => throwError(() => error))),
      ),
    );
  }

  private entityId(value: unknown) {
    if (
      value &&
      typeof value === "object" &&
      "id" in value &&
      typeof value.id === "string"
    )
      return value.id;
    return undefined;
  }
}

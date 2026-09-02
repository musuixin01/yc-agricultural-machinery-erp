import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { AuthenticatedUser } from "./authenticated-user.js";
import { REQUIRED_PERMISSIONS } from "./require-permissions.decorator.js";

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}
  canActivate(context: ExecutionContext) {
    const required =
      this.reflector.getAllAndOverride<string[]>(REQUIRED_PERMISSIONS, [
        context.getHandler(),
        context.getClass(),
      ]) ?? [];
    const request = context.switchToHttp().getRequest<{
      user: AuthenticatedUser;
    }>();
    if (required.every((code) => request.user.permissions.includes(code)))
      return true;
    throw new ForbiddenException({
      code: "PERMISSION_DENIED",
      detail: "当前账号没有执行此操作的权限。",
      required,
    });
  }
}

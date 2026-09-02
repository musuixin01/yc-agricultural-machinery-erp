import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { IdentityService } from "./identity.service.js";

@Injectable()
export class AuthenticationGuard implements CanActivate {
  constructor(private readonly identity: IdentityService) {}
  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<{
      headers: { authorization?: string };
      user?: unknown;
    }>();
    const [scheme, token] = request.headers.authorization?.split(" ") ?? [];
    if (scheme !== "Bearer" || !token)
      throw new UnauthorizedException({
        code: "AUTH_REQUIRED",
        detail: "请先登录。",
      });
    request.user = await this.identity.authenticate(token);
    return true;
  }
}

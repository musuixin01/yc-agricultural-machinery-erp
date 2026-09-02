import { ForbiddenException } from "@nestjs/common";
import { describe, expect, it } from "vitest";
import { PermissionsGuard } from "../src/modules/identity/permissions.guard.js";

function context(permissions: string[]) {
  return {
    getHandler: () => function handler() {},
    getClass: () => class Controller {},
    switchToHttp: () => ({
      getRequest: () => ({ user: { permissions } }),
    }),
  };
}

describe("PermissionsGuard", () => {
  const reflector = {
    getAllAndOverride: () => ["identity.manage"],
  };

  it("allows a user with every required permission", () => {
    const guard = new PermissionsGuard(reflector as never);
    expect(guard.canActivate(context(["identity.manage"]) as never)).toBe(true);
  });

  it("rejects direct API access when the permission is missing", () => {
    const guard = new PermissionsGuard(reflector as never);
    expect(() => guard.canActivate(context(["catalog.read"]) as never)).toThrow(
      ForbiddenException,
    );
  });
});

import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  OnModuleInit,
  UnauthorizedException,
} from "@nestjs/common";
import { Prisma } from "../../generated/prisma/client.js";
import { PrismaService } from "../../infrastructure/prisma/prisma.service.js";
import type { AuthenticatedUser } from "./authenticated-user.js";
import {
  ACCESS_TTL_MS,
  EMPLOYEE_ROLES,
  LOGIN_LOCK_MS,
  MAX_LOGIN_FAILURES,
  PERMISSIONS,
  REFRESH_TTL_MS,
} from "./identity.constants.js";
import { hashPassword, verifyPassword } from "./password.js";
import { hashToken, issueOpaqueToken } from "./tokens.js";

const userInclude = {
  roles: {
    include: {
      role: { include: { permissions: { include: { permission: true } } } },
    },
  },
} satisfies Prisma.UserInclude;

type UserWithAccess = Prisma.UserGetPayload<{ include: typeof userInclude }>;
// Valid scrypt envelope used only to keep unknown-user login timing close to a wrong password.
const DUMMY_PASSWORD_HASH =
  "scrypt$131072$8$1$ZIWZO4za4LX9ktSR5W_-Yw$eRxT1GOfm-PpJhgV97B365bnGAMrPU5RV1cjUqr2heI";

@Injectable()
export class IdentityService implements OnModuleInit {
  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit() {
    await this.ensureEmployeeRoles();
  }

  async bootstrapStatus() {
    return { required: (await this.prisma.user.count()) === 0 };
  }

  async bootstrapOwner(
    input: {
      username: string;
      displayName: string;
      password: string;
      deviceName: string;
    },
    context: { ipAddress?: string; userAgent?: string },
  ) {
    const passwordHash = await hashPassword(input.password);
    let user: UserWithAccess;
    try {
      user = await this.prisma.$transaction(
        async (transaction) => {
          await transaction.$queryRaw`SELECT pg_advisory_xact_lock(924617301)::text AS locked`;
          if ((await transaction.user.count()) !== 0) {
            throw new ConflictException({
              code: "BOOTSTRAP_COMPLETED",
              detail: "老板账号已经初始化，请直接登录。",
            });
          }
          const permissions = [];
          for (const [code, name] of PERMISSIONS) {
            permissions.push(
              await transaction.permission.upsert({
                where: { code },
                update: { name },
                create: { code, name },
              }),
            );
          }
          const role = await transaction.role.create({
            data: {
              code: "OWNER",
              name: "经营者",
              description: "系统初始化经营者，拥有首版全部权限。",
              isSystem: true,
              permissions: {
                create: permissions.map((permission) => ({
                  permissionId: permission.id,
                })),
              },
            },
          });
          const created = await transaction.user.create({
            data: {
              username: input.username,
              displayName: input.displayName,
              passwordHash,
              roles: { create: { roleId: role.id } },
            },
            include: userInclude,
          });
          await transaction.auditEvent.create({
            data: {
              actorUserId: created.id,
              action: "identity.bootstrap_owner",
              entityType: "User",
              entityId: created.id,
              result: "SUCCESS",
              ipAddress: context.ipAddress,
            },
          });
          return created;
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error) {
      if (error instanceof ConflictException) throw error;
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        throw new ConflictException({
          code: "BOOTSTRAP_CONFLICT",
          detail: "账号初始化发生冲突，请刷新后登录。",
        });
      }
      throw error;
    }
    return this.createSession(user, input.deviceName, context.userAgent);
  }

  async login(
    input: { username: string; password: string; deviceName: string },
    context: { ipAddress?: string; userAgent?: string },
  ) {
    const user = await this.prisma.user.findUnique({
      where: { username: input.username },
      include: userInclude,
    });
    const valid = await verifyPassword(
      input.password,
      user?.passwordHash ?? DUMMY_PASSWORD_HASH,
    );
    const locked = user?.lockedUntil && user.lockedUntil > new Date();
    if (!user || !valid || user.status === "INACTIVE" || locked) {
      if (user && !valid && user.status !== "INACTIVE") {
        const failures = user.failedLoginCount + 1;
        await this.prisma.user.update({
          where: { id: user.id },
          data: {
            failedLoginCount: failures,
            ...(failures >= MAX_LOGIN_FAILURES
              ? {
                  status: "LOCKED",
                  lockedUntil: new Date(Date.now() + LOGIN_LOCK_MS),
                }
              : {}),
          },
        });
      }
      await this.prisma.auditEvent.create({
        data: {
          actorUserId: user?.id,
          action: "identity.login",
          entityType: "AuthSession",
          result: "FAILURE",
          ipAddress: context.ipAddress,
          metadata: { username: input.username },
        },
      });
      throw new UnauthorizedException({
        code: "LOGIN_FAILED",
        detail: "账号或密码错误，或账号暂时不可用。",
      });
    }
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        failedLoginCount: 0,
        lockedUntil: null,
        status: "ACTIVE",
        lastLoginAt: new Date(),
      },
    });
    await this.prisma.auditEvent.create({
      data: {
        actorUserId: user.id,
        action: "identity.login",
        entityType: "AuthSession",
        result: "SUCCESS",
        ipAddress: context.ipAddress,
      },
    });
    return this.createSession(
      { ...user, status: "ACTIVE" },
      input.deviceName,
      context.userAgent,
    );
  }

  async authenticate(token: string): Promise<AuthenticatedUser> {
    const session = await this.prisma.authSession.findUnique({
      where: { accessTokenHash: hashToken(token) },
      include: { user: { include: userInclude } },
    });
    if (
      !session ||
      session.revokedAt ||
      session.accessExpiresAt <= new Date() ||
      session.user.status !== "ACTIVE"
    ) {
      throw new UnauthorizedException({
        code: "SESSION_INVALID",
        detail: "登录已失效，请重新登录。",
      });
    }
    return this.toAuthenticatedUser(session.user, session.id);
  }

  async refresh(refreshToken: string) {
    const session = await this.prisma.authSession.findUnique({
      where: { refreshTokenHash: hashToken(refreshToken) },
      include: { user: { include: userInclude } },
    });
    if (
      !session ||
      session.revokedAt ||
      session.refreshExpiresAt <= new Date() ||
      session.user.status !== "ACTIVE"
    ) {
      throw new UnauthorizedException({
        code: "REFRESH_INVALID",
        detail: "登录已过期，请重新登录。",
      });
    }
    const accessToken = issueOpaqueToken();
    const nextRefreshToken = issueOpaqueToken();
    const accessExpiresAt = new Date(Date.now() + ACCESS_TTL_MS);
    const refreshExpiresAt = new Date(Date.now() + REFRESH_TTL_MS);
    const updated = await this.prisma.authSession.updateMany({
      where: {
        id: session.id,
        refreshTokenHash: hashToken(refreshToken),
        revokedAt: null,
      },
      data: {
        accessTokenHash: hashToken(accessToken),
        refreshTokenHash: hashToken(nextRefreshToken),
        accessExpiresAt,
        refreshExpiresAt,
        lastSeenAt: new Date(),
      },
    });
    if (updated.count !== 1)
      throw new UnauthorizedException({
        code: "REFRESH_REUSED",
        detail: "登录凭证已被使用，请重新登录。",
      });
    return {
      accessToken,
      refreshToken: nextRefreshToken,
      expiresIn: Math.floor(ACCESS_TTL_MS / 1000),
      user: this.toAuthenticatedUser(session.user, session.id),
    };
  }

  async logout(sessionId: string, actorUserId: string) {
    await this.prisma.$transaction([
      this.prisma.authSession.updateMany({
        where: { id: sessionId, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
      this.prisma.auditEvent.create({
        data: {
          actorUserId,
          action: "identity.logout",
          entityType: "AuthSession",
          entityId: sessionId,
          result: "SUCCESS",
        },
      }),
    ]);
    return { success: true };
  }

  async listRoles() {
    await this.ensureEmployeeRoles();
    return this.prisma.role.findMany({
      where: { code: { in: EMPLOYEE_ROLES.map((role) => role.code) } },
      orderBy: { name: "asc" },
      select: {
        id: true,
        code: true,
        name: true,
        description: true,
        permissions: {
          orderBy: { permission: { code: "asc" } },
          select: { permission: { select: { code: true, name: true } } },
        },
      },
    });
  }

  async listUsers(query: {
    search?: string;
    status?: "ACTIVE" | "LOCKED" | "INACTIVE";
    page: number;
    pageSize: number;
  }) {
    const where: Prisma.UserWhereInput = {
      ...(query.status ? { status: query.status } : {}),
      ...(query.search
        ? {
            OR: [
              { username: { contains: query.search, mode: "insensitive" } },
              { displayName: { contains: query.search, mode: "insensitive" } },
            ],
          }
        : {}),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where,
        orderBy: [{ status: "asc" }, { displayName: "asc" }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        select: {
          id: true,
          username: true,
          displayName: true,
          status: true,
          failedLoginCount: true,
          lockedUntil: true,
          lastLoginAt: true,
          version: true,
          createdAt: true,
          roles: { select: { role: { select: { code: true, name: true } } } },
          sessions: {
            where: { revokedAt: null, refreshExpiresAt: { gt: new Date() } },
            select: { id: true },
          },
        },
      }),
      this.prisma.user.count({ where }),
    ]);
    return {
      items: items.map(({ sessions, roles, ...user }) => ({
        ...user,
        roles: roles.map(({ role }) => role),
        activeSessionCount: sessions.length,
      })),
      page: query.page,
      pageSize: query.pageSize,
      total,
    };
  }

  async createUser(input: {
    username: string;
    displayName: string;
    password: string;
    roleCodes: string[];
  }) {
    const allowed = new Set(EMPLOYEE_ROLES.map((role) => role.code as string));
    if (input.roleCodes.some((code) => !allowed.has(code))) {
      throw new BadRequestException({
        code: "ROLE_NOT_ASSIGNABLE",
        detail: "包含不可分配的岗位角色。",
      });
    }
    await this.ensureEmployeeRoles();
    const roles = await this.prisma.role.findMany({
      where: { code: { in: input.roleCodes } },
      select: { id: true },
    });
    if (roles.length !== input.roleCodes.length) {
      throw new BadRequestException({
        code: "ROLE_NOT_FOUND",
        detail: "岗位角色不存在，请刷新后重试。",
      });
    }
    try {
      const user = await this.prisma.user.create({
        data: {
          username: input.username,
          displayName: input.displayName,
          passwordHash: await hashPassword(input.password),
          roles: { create: roles.map((role) => ({ roleId: role.id })) },
        },
        include: userInclude,
      });
      return this.toUserView(user, 0);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        throw new ConflictException({
          code: "USERNAME_DUPLICATE",
          detail: "登录账号已经存在。",
        });
      }
      throw error;
    }
  }

  async updateUserStatus(
    id: string,
    input: { status: "ACTIVE" | "INACTIVE"; version: number },
    actor: AuthenticatedUser,
  ) {
    if (id === actor.id) {
      throw new BadRequestException({
        code: "SELF_STATUS_CHANGE_FORBIDDEN",
        detail: "不能停用或修改当前登录账号的状态。",
      });
    }
    const current = await this.prisma.user.findUnique({ where: { id } });
    if (!current)
      throw new NotFoundException({
        code: "USER_NOT_FOUND",
        detail: "员工账号不存在。",
      });
    const result = await this.prisma.$transaction(async (transaction) => {
      const updated = await transaction.user.updateMany({
        where: { id, version: input.version },
        data: {
          status: input.status,
          failedLoginCount: 0,
          lockedUntil: null,
          version: { increment: 1 },
        },
      });
      if (updated.count !== 1) return false;
      if (input.status === "INACTIVE") {
        await transaction.authSession.updateMany({
          where: { userId: id, revokedAt: null },
          data: { revokedAt: new Date() },
        });
      }
      return true;
    });
    if (!result)
      throw new ConflictException({
        code: "USER_VERSION_CONFLICT",
        detail: "员工账号已被其他人修改，请刷新后重试。",
      });
    return this.getUserView(id);
  }

  async resetPassword(id: string, password: string, actor: AuthenticatedUser) {
    if (id === actor.id) {
      throw new BadRequestException({
        code: "SELF_PASSWORD_RESET_FORBIDDEN",
        detail: "当前账号请使用修改密码功能，不能在员工管理中重置。",
      });
    }
    const passwordHash = await hashPassword(password);
    const updated = await this.prisma.$transaction(async (transaction) => {
      const user = await transaction.user.updateMany({
        where: { id },
        data: {
          passwordHash,
          failedLoginCount: 0,
          lockedUntil: null,
          status: "ACTIVE",
          version: { increment: 1 },
        },
      });
      if (user.count !== 1) return false;
      await transaction.authSession.updateMany({
        where: { userId: id, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      return true;
    });
    if (!updated)
      throw new NotFoundException({
        code: "USER_NOT_FOUND",
        detail: "员工账号不存在。",
      });
    return { success: true };
  }

  async revokeUserSessions(id: string, actor: AuthenticatedUser) {
    if (id === actor.id) {
      throw new BadRequestException({
        code: "SELF_SESSION_REVOKE_FORBIDDEN",
        detail: "请使用安全退出结束当前设备会话。",
      });
    }
    if (
      !(await this.prisma.user.findUnique({
        where: { id },
        select: { id: true },
      }))
    ) {
      throw new NotFoundException({
        code: "USER_NOT_FOUND",
        detail: "员工账号不存在。",
      });
    }
    const result = await this.prisma.authSession.updateMany({
      where: { userId: id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return { success: true, revokedCount: result.count };
  }

  async listAudit(query: {
    action?: string;
    result?: "SUCCESS" | "FAILURE";
    page: number;
    pageSize: number;
  }) {
    const where: Prisma.AuditEventWhereInput = {
      ...(query.action
        ? { action: { contains: query.action, mode: "insensitive" } }
        : {}),
      ...(query.result ? { result: query.result } : {}),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.auditEvent.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        select: {
          id: true,
          action: true,
          entityType: true,
          entityId: true,
          result: true,
          ipAddress: true,
          metadata: true,
          createdAt: true,
          actor: { select: { id: true, username: true, displayName: true } },
        },
      }),
      this.prisma.auditEvent.count({ where }),
    ]);
    return { items, page: query.page, pageSize: query.pageSize, total };
  }

  async recordAudit(input: {
    actorUserId: string;
    action: string;
    entityType: string;
    entityId?: string;
    result: "SUCCESS" | "FAILURE";
    ipAddress?: string;
    metadata?: Record<string, string | number | boolean | null>;
  }) {
    await this.prisma.auditEvent.create({ data: input });
  }

  private async ensureEmployeeRoles() {
    await this.prisma.$transaction(async (transaction) => {
      const permissionIds = new Map<string, string>();
      for (const [code, name] of PERMISSIONS) {
        const permission = await transaction.permission.upsert({
          where: { code },
          update: { name },
          create: { code, name },
        });
        permissionIds.set(code, permission.id);
      }
      for (const definition of EMPLOYEE_ROLES) {
        const role = await transaction.role.upsert({
          where: { code: definition.code },
          update: {
            name: definition.name,
            description: definition.description,
            isSystem: true,
          },
          create: {
            code: definition.code,
            name: definition.name,
            description: definition.description,
            isSystem: true,
          },
        });
        const assignments = definition.permissions.map((code) => ({
          roleId: role.id,
          permissionId: permissionIds.get(code)!,
        }));
        await transaction.rolePermission.deleteMany({
          where: {
            roleId: role.id,
            permissionId: {
              notIn: assignments.map((item) => item.permissionId),
            },
          },
        });
        await transaction.rolePermission.createMany({
          data: assignments,
          skipDuplicates: true,
        });
      }
      const owner = await transaction.role.findUnique({
        where: { code: "OWNER" },
      });
      if (owner) {
        await transaction.rolePermission.createMany({
          data: [...permissionIds.values()].map((permissionId) => ({
            roleId: owner.id,
            permissionId,
          })),
          skipDuplicates: true,
        });
      }
    });
  }

  private async getUserView(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: {
        ...userInclude,
        sessions: {
          where: { revokedAt: null, refreshExpiresAt: { gt: new Date() } },
          select: { id: true },
        },
      },
    });
    if (!user)
      throw new NotFoundException({
        code: "USER_NOT_FOUND",
        detail: "员工账号不存在。",
      });
    return this.toUserView(user, user.sessions.length);
  }

  private toUserView(user: UserWithAccess, activeSessionCount: number) {
    return {
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      status: user.status,
      failedLoginCount: user.failedLoginCount,
      lockedUntil: user.lockedUntil,
      lastLoginAt: user.lastLoginAt,
      version: user.version,
      createdAt: user.createdAt,
      roles: user.roles.map(({ role }) => ({
        code: role.code,
        name: role.name,
      })),
      activeSessionCount,
    };
  }

  private async createSession(
    user: UserWithAccess,
    deviceName: string,
    userAgent?: string,
  ) {
    const accessToken = issueOpaqueToken();
    const refreshToken = issueOpaqueToken();
    const accessExpiresAt = new Date(Date.now() + ACCESS_TTL_MS);
    const session = await this.prisma.authSession.create({
      data: {
        userId: user.id,
        accessTokenHash: hashToken(accessToken),
        refreshTokenHash: hashToken(refreshToken),
        accessExpiresAt,
        refreshExpiresAt: new Date(Date.now() + REFRESH_TTL_MS),
        deviceName,
        userAgent,
      },
    });
    return {
      accessToken,
      refreshToken,
      expiresIn: Math.floor(ACCESS_TTL_MS / 1000),
      user: this.toAuthenticatedUser(user, session.id),
    };
  }

  private toAuthenticatedUser(
    user: UserWithAccess,
    sessionId: string,
  ): AuthenticatedUser {
    return {
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      roles: user.roles.map(({ role }) => role.code),
      permissions: [
        ...new Set(
          user.roles.flatMap(({ role }) =>
            role.permissions.map(({ permission }) => permission.code),
          ),
        ),
      ],
      sessionId,
    };
  }
}

import { ConflictException, Injectable } from "@nestjs/common";
import { PrismaService } from "../../infrastructure/prisma/prisma.service.js";
import type { AuthenticatedUser } from "../identity/authenticated-user.js";
import type { UpdateBusinessProfileDto } from "./dto/update-business-profile.dto.js";

@Injectable()
export class AdministrationService {
  constructor(private readonly prisma: PrismaService) {}

  async getBusinessProfile() {
    const profile = await this.prisma.businessProfile.findUniqueOrThrow({
      where: { id: "primary" },
      include: { updatedBy: { select: { id: true, displayName: true } } },
    });
    return this.toView(profile);
  }

  async updateBusinessProfile(
    input: UpdateBusinessProfileDto,
    actor: AuthenticatedUser,
    ipAddress?: string,
  ) {
    const data = {
      storeName: input.storeName.trim(),
      shortName: input.shortName.trim(),
      phone: input.phone?.trim() || null,
      address: input.address?.trim() || null,
      receiptFooter: input.receiptFooter?.trim() || null,
      defaultPaperSize: input.defaultPaperSize,
      updatedById: actor.id,
    } as const;
    if (!data.storeName || !data.shortName)
      throw new ConflictException({
        code: "BUSINESS_PROFILE_NAME_REQUIRED",
        detail: "门店名称和简称不能为空。",
      });

    const updated = await this.prisma.$transaction(async (transaction) => {
      const changed = await transaction.businessProfile.updateMany({
        where: { id: "primary", version: input.version },
        data: { ...data, version: { increment: 1 } },
      });
      if (changed.count !== 1) return null;
      await transaction.auditEvent.create({
        data: {
          actorUserId: actor.id,
          action: "administration.business_profile.update",
          entityType: "BusinessProfile",
          entityId: "primary",
          result: "SUCCESS",
          ipAddress,
          metadata: {
            storeName: data.storeName,
            shortName: data.shortName,
            phoneConfigured: Boolean(data.phone),
            addressConfigured: Boolean(data.address),
            defaultPaperSize: data.defaultPaperSize,
          },
        },
      });
      return transaction.businessProfile.findUniqueOrThrow({
        where: { id: "primary" },
        include: { updatedBy: { select: { id: true, displayName: true } } },
      });
    });
    if (!updated)
      throw new ConflictException({
        code: "BUSINESS_PROFILE_VERSION_CONFLICT",
        detail: "门店资料已被其他设备修改，请刷新后重新保存。",
      });
    return this.toView(updated);
  }

  private toView(profile: {
    id: string;
    storeName: string;
    shortName: string;
    phone: string | null;
    address: string | null;
    receiptFooter: string | null;
    defaultPaperSize: "A4" | "RECEIPT_80MM";
    version: number;
    updatedAt: Date;
    updatedBy: { id: string; displayName: string } | null;
  }) {
    return {
      ...profile,
      updatedAt: profile.updatedAt.toISOString(),
    };
  }
}

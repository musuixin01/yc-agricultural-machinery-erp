import { Inject, Injectable } from "@nestjs/common";
import type { Prisma } from "../../generated/prisma/client.js";
import { PrismaService } from "../../infrastructure/prisma/prisma.service.js";
import type { CreatePartyDto } from "./dto/create-party.dto.js";
import type { QueryPartiesDto } from "./dto/query-parties.dto.js";
import type { PartiesRepository } from "./parties.repository.js";
import type {
  PartyPage,
  PartyRoleType,
  PartyStatus,
  PartyView,
} from "./parties.types.js";
import { SYSTEM_WALK_IN_CUSTOMER_CODE } from "./parties.constants.js";
import { prepareIdentityNumber, preparePortrait } from "./customer-pii.js";

const partyInclude = {
  roles: { orderBy: { type: "asc" as const } },
  contacts: {
    orderBy: [{ isPrimary: "desc" as const }, { createdAt: "asc" as const }],
  },
} satisfies Prisma.PartyInclude;
const partyOmit = {
  identityNumberEncrypted: true,
  identityNumberHash: true,
  portraitImage: true,
} satisfies Prisma.PartyOmit;
type PartyRecord = Prisma.PartyGetPayload<{
  include: typeof partyInclude;
  omit: typeof partyOmit;
}>;
function toView(p: PartyRecord): PartyView {
  return {
    id: p.id,
    code: p.code,
    name: p.name,
    shortName: p.shortName,
    mnemonicCode: p.mnemonicCode,
    taxId: p.taxId,
    identityNumberMasked: p.identityNumberLast4
      ? `**************${p.identityNumberLast4}`
      : null,
    hasPortrait: Boolean(p.portraitMimeType),
    roles: p.roles.map((r) => r.type as PartyRoleType),
    creditLimit: p.creditLimit.toFixed(4),
    paymentTermsDays: p.paymentTermsDays,
    paymentTermsMonths: p.paymentTermsMonths,
    province: p.province,
    city: p.city,
    address: p.address,
    notes: p.notes,
    contacts: p.contacts.map((c) => ({
      id: c.id,
      name: c.name,
      phone: c.phone,
      email: c.email,
      position: c.position,
      isPrimary: c.isPrimary,
    })),
    status: p.status as PartyStatus,
    version: p.version,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
  };
}

@Injectable()
export class PrismaPartiesRepository implements PartiesRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}
  async list(query: QueryPartiesDto): Promise<PartyPage> {
    const search = query.search?.trim();
    const where: Prisma.PartyWhereInput = {
      code: { not: SYSTEM_WALK_IN_CUSTOMER_CODE },
      status: query.status,
      roles: query.role ? { some: { type: query.role } } : undefined,
      ...(search
        ? {
            OR: [
              { code: { contains: search, mode: "insensitive" } },
              { name: { contains: search, mode: "insensitive" } },
              { shortName: { contains: search, mode: "insensitive" } },
              { mnemonicCode: { contains: search, mode: "insensitive" } },
              {
                contacts: {
                  some: {
                    OR: [
                      { name: { contains: search, mode: "insensitive" } },
                      { phone: { contains: search } },
                    ],
                  },
                },
              },
            ],
          }
        : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.party.findMany({
        where,
        include: partyInclude,
        omit: partyOmit,
        orderBy: [{ status: "asc" }, { updatedAt: "desc" }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.party.count({ where }),
    ]);
    return {
      items: items.map(toView),
      page: query.page,
      pageSize: query.pageSize,
      total,
    };
  }
  async findById(id: string) {
    const item = await this.prisma.party.findUnique({
      where: { id },
      include: partyInclude,
      omit: partyOmit,
    });
    return item ? toView(item) : null;
  }
  async create(input: CreatePartyDto) {
    const primary = input.contacts?.findIndex((c) => c.isPrimary) ?? -1;
    const identity = prepareIdentityNumber(input.identityNumber);
    const portrait = preparePortrait(input.portraitDataUrl);
    const item = await this.prisma.party.create({
      data: {
        code: input.code,
        name: input.name,
        shortName: input.shortName,
        mnemonicCode: input.mnemonicCode,
        taxId: input.taxId,
        identityNumberEncrypted: identity?.encrypted,
        identityNumberHash: identity?.hash,
        identityNumberLast4: identity?.last4,
        portraitImage: portrait?.bytes,
        portraitMimeType: portrait?.mimeType,
        creditLimit: input.creditLimit ?? "0",
        paymentTermsDays: input.paymentTermsDays ?? 0,
        paymentTermsMonths: input.paymentTermsMonths ?? 0,
        province: input.province,
        city: input.city,
        address: input.address,
        notes: input.notes,
        roles: { create: input.roles.map((type) => ({ type })) },
        contacts: input.contacts?.length
          ? {
              create: input.contacts.map((c, index) => ({
                ...c,
                isPrimary: primary >= 0 ? index === primary : index === 0,
              })),
            }
          : undefined,
      },
      include: partyInclude,
      omit: partyOmit,
    });
    return toView(item);
  }
  async updateStatus(id: string, status: PartyStatus, version: number) {
    const result = await this.prisma.party.updateMany({
      where: { id, version },
      data: { status, version: { increment: 1 } },
    });
    return result.count === 1 ? this.findById(id) : null;
  }
}

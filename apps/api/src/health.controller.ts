import { Controller, Get, Inject } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { PrismaService } from "./infrastructure/prisma/prisma.service.js";

@ApiTags("system")
@Controller("health")
export class HealthController {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  @Get()
  async health() {
    await this.prisma.$queryRaw`SELECT 1`;
    return {
      status: "ok",
      database: "up",
      timestamp: new Date().toISOString(),
    };
  }
}

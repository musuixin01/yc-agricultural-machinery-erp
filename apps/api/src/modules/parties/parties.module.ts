import { Module } from "@nestjs/common";
import { PartiesController } from "./parties.controller.js";
import { PARTIES_REPOSITORY } from "./parties.repository.js";
import { PartiesService } from "./parties.service.js";
import { PrismaPartiesRepository } from "./prisma-parties.repository.js";
@Module({
  controllers: [PartiesController],
  providers: [
    PartiesService,
    { provide: PARTIES_REPOSITORY, useClass: PrismaPartiesRepository },
  ],
  exports: [PartiesService],
})
export class PartiesModule {}

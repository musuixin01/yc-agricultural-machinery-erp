import { ApiProperty } from "@nestjs/swagger";
import { IsIn, IsInt, Min } from "class-validator";
import { PARTY_STATUSES, type PartyStatus } from "../parties.types.js";
export class UpdatePartyStatusDto {
  @ApiProperty({ enum: PARTY_STATUSES })
  @IsIn(PARTY_STATUSES)
  status!: PartyStatus;
  @ApiProperty({ minimum: 1 }) @IsInt() @Min(1) version!: number;
}

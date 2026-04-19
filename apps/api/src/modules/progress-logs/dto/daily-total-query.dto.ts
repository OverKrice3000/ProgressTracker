import { IsOptional, IsString, IsUUID, Matches } from 'class-validator';

/** ISO 8601 instant bounds for the user's local calendar day [dayStart, dayEnd). */
export class DailyTotalQueryDto {
  @IsString()
  dayStart!: string;

  @IsString()
  dayEnd!: string;

  @IsOptional()
  @IsUUID()
  excludeLogId?: string;
}

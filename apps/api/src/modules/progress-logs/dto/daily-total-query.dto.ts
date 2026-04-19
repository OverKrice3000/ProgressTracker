import { IsOptional, IsString, IsUUID, Matches } from 'class-validator';

/** ISO 8601 instant bounds for the user's local calendar day [dayStart, dayEnd). */
export class DailyTotalQueryDto {
  @IsString()
  dayStart!: string;

  @IsString()
  dayEnd!: string;

  /** When set, total is summed for this calendar day using `logged_date` (preferred). */
  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  dateYmd?: string;

  @IsOptional()
  @IsUUID()
  excludeLogId?: string;
}

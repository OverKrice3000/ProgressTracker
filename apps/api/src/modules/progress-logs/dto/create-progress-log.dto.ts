import { Type } from 'class-transformer';
import { IsInt, IsObject, IsOptional, IsString, Matches, Max, Min } from 'class-validator';

export class CreateProgressLogDto {
  @IsOptional()
  @IsString()
  timestamp?: string;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(1440)
  timeSpentMinutes!: number;

  @IsObject()
  trackerMetadata!: Record<string, unknown>;

  /** Local calendar day (YYYY-MM-DD) this log counts toward; must match the selected date in the UI. */
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  loggedDateYmd!: string;

  /** [dayStart, dayEnd) ISO bounds for the selected calendar day; used to enforce 24h daily cap. */
  @IsOptional()
  @IsString()
  dayStartIso?: string;

  @IsOptional()
  @IsString()
  dayEndIso?: string;
}

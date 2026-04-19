import { Type } from 'class-transformer';
import { IsInt, IsObject, IsOptional, IsString, Matches, Max, Min } from 'class-validator';

export class UpdateProgressLogDto {
  @IsOptional()
  @IsString()
  timestamp?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(1440)
  timeSpentMinutes?: number;

  @IsOptional()
  @IsObject()
  trackerMetadata?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  loggedDateYmd?: string;

  @IsOptional()
  @IsString()
  dayStartIso?: string;

  @IsOptional()
  @IsString()
  dayEndIso?: string;
}

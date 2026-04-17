import { IsInt, IsObject, IsOptional, IsString, Max, Min } from 'class-validator';

export class CreateProgressLogDto {
  @IsOptional()
  @IsString()
  timestamp?: string;

  @IsInt()
  @Min(0)
  @Max(1440)
  timeSpentMinutes!: number;

  @IsObject()
  trackerMetadata!: Record<string, unknown>;
}

import { TrackerType } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class CreateTaskSequenceDto {
  @IsOptional()
  @IsString()
  parentId?: string;

  /** May contain `{expression}` blocks where `n` is the 1-based task index. */
  @IsString()
  @MaxLength(120)
  name!: string;

  /** May contain `{expression}` blocks. */
  @IsOptional()
  @IsString()
  @MaxLength(1024)
  description?: string;

  @IsEnum(TrackerType)
  trackerType!: TrackerType;

  /** NUMBER tracker target: whole number or `{expression}`. */
  @IsOptional()
  @IsString()
  total?: string;

  /** TIME tracker hours: whole number or `{expression}`. */
  @IsOptional()
  @IsString()
  durationHours?: string;

  /** TIME tracker minutes: whole number or `{expression}` (0–59 per task). */
  @IsOptional()
  @IsString()
  durationMinutes?: string;

  @IsInt()
  @Min(1)
  @Max(100)
  @Type(() => Number)
  count!: number;
}

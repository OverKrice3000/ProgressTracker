import { TrackerType } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Matches, Max, MaxLength, Min } from 'class-validator';

/** Matches either the literal token `{n}` or a non-negative integer string. */
const TOKEN_OR_NON_NEG_INT = /^(\{n\}|\d+)$/;

export class CreateTaskSequenceDto {
  @IsOptional()
  @IsString()
  parentId?: string;

  /** May contain `{n}` which is substituted with the task index (1-based). */
  @IsString()
  @MaxLength(120)
  name!: string;

  /** May contain `{n}`. */
  @IsOptional()
  @IsString()
  @MaxLength(1024)
  description?: string;

  @IsEnum(TrackerType)
  trackerType!: TrackerType;

  /** For NUMBER tracker: the target counter value. May be `{n}` or a positive integer string. */
  @IsOptional()
  @IsString()
  @Matches(TOKEN_OR_NON_NEG_INT)
  total?: string;

  /** For TIME tracker: hours component. May be `{n}` or a non-negative integer string. */
  @IsOptional()
  @IsString()
  @Matches(TOKEN_OR_NON_NEG_INT)
  durationHours?: string;

  /** For TIME tracker: minutes component (0–59 after token substitution). May be `{n}`. */
  @IsOptional()
  @IsString()
  @Matches(TOKEN_OR_NON_NEG_INT)
  durationMinutes?: string;

  @IsInt()
  @Min(1)
  @Max(100)
  @Type(() => Number)
  count!: number;
}

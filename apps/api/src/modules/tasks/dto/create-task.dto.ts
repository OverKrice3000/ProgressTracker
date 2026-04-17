import { TrackerType } from '@prisma/client';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateTaskDto {
  @IsOptional()
  @IsString()
  parentId?: string;

  @IsString()
  @MaxLength(120)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(1024)
  description?: string;

  @IsOptional()
  @IsString()
  avatarUrl?: string;

  @IsOptional()
  @IsBoolean()
  isCompleted?: boolean;

  @IsEnum(TrackerType)
  trackerType!: TrackerType;

  @IsObject()
  trackerMetadata!: Record<string, unknown>;

  @IsOptional()
  @IsInt()
  @Min(0)
  depth?: number;
}

import { TrackerType } from '@prisma/client';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Min,
  ValidateIf,
} from 'class-validator';

export class BooleanMetadataDto {
  @IsBoolean()
  current!: boolean;

  @IsBoolean()
  total!: boolean;
}

export class NumberMetadataDto {
  @IsInt()
  @Min(0)
  current!: number;

  @IsInt()
  @Min(1)
  total!: number;

  @IsOptional()
  @IsString()
  unit?: string;
}

export class TimeMetadataDto {
  @IsInt()
  @Min(0)
  currentMinutes!: number;

  @IsInt()
  @Min(1)
  totalMinutes!: number;
}

export class SubtaskMetadataDto {
  @IsArray()
  @IsString({ each: true })
  childIds!: string[];
}

export class TaskTrackerDto {
  @IsEnum(TrackerType)
  trackerType!: TrackerType;

  @IsObject()
  trackerMetadata!: Record<string, unknown>;

  @ValidateIf((self: TaskTrackerDto) => self.trackerType === TrackerType.BOOLEAN)
  boolean?: BooleanMetadataDto;

  @ValidateIf((self: TaskTrackerDto) => self.trackerType === TrackerType.NUMBER)
  number?: NumberMetadataDto;

  @ValidateIf((self: TaskTrackerDto) => self.trackerType === TrackerType.TIME)
  time?: TimeMetadataDto;

  @ValidateIf((self: TaskTrackerDto) => self.trackerType === TrackerType.SUBTASK)
  subtask?: SubtaskMetadataDto;
}

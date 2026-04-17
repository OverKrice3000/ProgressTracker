import { TrackerType } from '@prisma/client';
import { IsBooleanString, IsEnum, IsIn, IsOptional, IsString } from 'class-validator';

export class TaskQueryDto {
  @IsOptional()
  @IsBooleanString()
  rootOnly?: string;

  @IsOptional()
  @IsBooleanString()
  isCompleted?: string;

  @IsOptional()
  @IsEnum(TrackerType)
  trackerType?: TrackerType;

  @IsOptional()
  @IsString()
  @IsIn(['name', 'trackerType', 'depth'])
  sortBy?: 'name' | 'trackerType' | 'depth';

  @IsOptional()
  @IsString()
  @IsIn(['asc', 'desc'])
  sortOrder?: 'asc' | 'desc';
}

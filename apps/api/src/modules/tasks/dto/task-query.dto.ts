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
  @IsBooleanString()
  includeHidden?: string;

  @IsOptional()
  @IsEnum(TrackerType)
  trackerType?: TrackerType;

  @IsOptional()
  @IsString()
  @IsIn(['name', 'trackerType', 'depth', 'recent'])
  sortBy?: 'name' | 'trackerType' | 'depth' | 'recent';

  @IsOptional()
  @IsString()
  @IsIn(['asc', 'desc'])
  sortOrder?: 'asc' | 'desc';
}

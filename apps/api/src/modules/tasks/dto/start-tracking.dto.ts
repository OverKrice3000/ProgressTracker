import { Type } from 'class-transformer';
import { IsBoolean, IsInt, IsOptional, IsString, Min } from 'class-validator';

export class StartTrackingDto {
  @IsString()
  taskId!: string;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  startTimeMs!: number;

  @IsOptional()
  @IsBoolean()
  stopExisting?: boolean;
}

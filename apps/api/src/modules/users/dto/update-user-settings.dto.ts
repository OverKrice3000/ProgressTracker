import { IsIn, IsNumber, IsOptional, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';

export const SUPPORTED_LANGUAGES = ['en', 'ru'] as const;
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

export class UpdateUserSettingsDto {
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(24)
  idleHoursPerDay?: number;

  @IsOptional()
  @IsIn(SUPPORTED_LANGUAGES)
  language?: SupportedLanguage;
}

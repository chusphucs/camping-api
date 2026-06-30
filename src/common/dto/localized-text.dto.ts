import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

/** Bilingual content payload: { vi, en }. Both languages required on write. */
export class LocalizedTextDto {
  @ApiProperty({ example: 'Lều 4 người' })
  @IsString()
  @MinLength(1)
  vi: string;

  @ApiProperty({ example: '4-Person Tent' })
  @IsString()
  @MinLength(1)
  en: string;
}

/** Optional bilingual text (e.g. description) — allows empty strings. */
export class OptionalLocalizedTextDto {
  @ApiProperty({ required: false })
  @IsString()
  vi: string;

  @ApiProperty({ required: false })
  @IsString()
  en: string;
}

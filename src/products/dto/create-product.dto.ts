import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Min,
  ValidateNested,
} from 'class-validator';
import {
  LocalizedTextDto,
  OptionalLocalizedTextDto,
} from '../../common/dto/localized-text.dto';

export class CreateProductDto {
  @ApiProperty({ type: LocalizedTextDto })
  @ValidateNested()
  @Type(() => LocalizedTextDto)
  name: LocalizedTextDto;

  @ApiPropertyOptional({ type: OptionalLocalizedTextDto })
  @ValidateNested()
  @Type(() => OptionalLocalizedTextDto)
  @IsOptional()
  description?: OptionalLocalizedTextDto;

  @ApiProperty({ example: 'tent-4p-waterproof' })
  @IsString()
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
    message: 'slug must be lowercase kebab-case',
  })
  slug: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsUUID()
  @IsOptional()
  categoryId?: string | null;

  @ApiProperty({ example: 150000, description: 'VND per day' })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  dailyRate: number;

  @ApiProperty({ example: 5 })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  inventoryQuantity: number;

  @ApiPropertyOptional({ default: true })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

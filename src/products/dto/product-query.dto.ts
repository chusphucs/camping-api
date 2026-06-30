import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsISO8601, IsOptional, IsString } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

export class ProductQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  categorySlug?: string;

  @ApiPropertyOptional({ description: 'Search in name (vi/en)' })
  @IsString()
  @IsOptional()
  q?: string;

  @ApiPropertyOptional({
    example: '2026-07-01',
    description: 'Range start for availability annotation',
  })
  @IsISO8601()
  @IsOptional()
  start?: string;

  @ApiPropertyOptional({ example: '2026-07-04' })
  @IsISO8601()
  @IsOptional()
  end?: string;
}

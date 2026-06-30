import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsISO8601, IsOptional, IsString } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { BookingStatus } from '../../common/types/enums';

export class BookingQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: BookingStatus })
  @IsEnum(BookingStatus)
  @IsOptional()
  status?: BookingStatus;

  @ApiPropertyOptional({ description: 'Search code / name / phone / email' })
  @IsString()
  @IsOptional()
  q?: string;

  @ApiPropertyOptional({ description: 'start_date >= from' })
  @IsISO8601()
  @IsOptional()
  from?: string;

  @ApiPropertyOptional({ description: 'start_date <= to' })
  @IsISO8601()
  @IsOptional()
  to?: string;
}

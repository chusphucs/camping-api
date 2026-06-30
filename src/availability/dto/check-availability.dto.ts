import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsInt,
  IsISO8601,
  IsUUID,
  Matches,
  Min,
  ValidateNested,
} from 'class-validator';
import {
  IsAfterDate,
  IsNotPastDate,
} from '../../common/validators/date.validators';

export class AvailabilityItemDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  productId: string;

  @ApiProperty({ example: 1, minimum: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  quantity: number;

  @ApiProperty({ example: '2026-07-01' })
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'startDate must be YYYY-MM-DD' })
  @IsISO8601()
  @IsNotPastDate()
  startDate: string;

  @ApiProperty({ example: '2026-07-04' })
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'endDate must be YYYY-MM-DD' })
  @IsISO8601()
  @IsAfterDate('startDate')
  endDate: string;
}

export class CheckAvailabilityDto {
  @ApiProperty({ type: [AvailabilityItemDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => AvailabilityItemDto)
  items: AvailabilityItemDto[];
}

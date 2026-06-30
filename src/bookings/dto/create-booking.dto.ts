import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsEmail,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import {
  IsAfterDate,
  IsNotPastDate,
} from '../../common/validators/date.validators';

export class BookingContactDto {
  @ApiProperty({ example: 'Nguyễn Văn A' })
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  fullName: string;

  @ApiProperty({ example: '0901234567' })
  @Matches(/^[0-9+\s()-]{6,20}$/, {
    message: 'phone is not a valid phone number',
  })
  phone: string;

  @ApiProperty({ example: 'a@example.com' })
  @IsEmail()
  email: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  @MaxLength(1000)
  note?: string;
}

export class BookingItemInputDto {
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

export class CreateBookingDto {
  @ApiProperty({ type: BookingContactDto })
  @ValidateNested()
  @Type(() => BookingContactDto)
  contact: BookingContactDto;

  @ApiProperty({ type: [BookingItemInputDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => BookingItemInputDto)
  items: BookingItemInputDto[];
}

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsEnum,
  IsOptional,
  IsString,
  IsUrl,
  Matches,
  ValidateNested,
} from 'class-validator';
import {
  LocalizedTextDto,
  OptionalLocalizedTextDto,
} from '../../common/dto/localized-text.dto';
import { PostStatus } from '../../common/types/enums';

export class CreateBlogDto {
  @ApiProperty({ type: LocalizedTextDto })
  @ValidateNested()
  @Type(() => LocalizedTextDto)
  title: LocalizedTextDto;

  @ApiPropertyOptional({ type: OptionalLocalizedTextDto })
  @ValidateNested()
  @Type(() => OptionalLocalizedTextDto)
  @IsOptional()
  excerpt?: OptionalLocalizedTextDto;

  @ApiPropertyOptional({ type: OptionalLocalizedTextDto })
  @ValidateNested()
  @Type(() => OptionalLocalizedTextDto)
  @IsOptional()
  body?: OptionalLocalizedTextDto;

  @ApiProperty({ example: 'camping-tips-for-beginners' })
  @IsString()
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
    message: 'slug must be lowercase kebab-case',
  })
  slug: string;

  @ApiPropertyOptional({ enum: PostStatus, default: PostStatus.DRAFT })
  @IsEnum(PostStatus)
  @IsOptional()
  status?: PostStatus;

  @ApiPropertyOptional()
  @IsUrl()
  @IsOptional()
  coverImageUrl?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  tags?: string[];

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  author?: string;
}

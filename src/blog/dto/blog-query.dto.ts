import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { PostStatus } from '../../common/types/enums';

export class BlogQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  tag?: string;

  @ApiPropertyOptional({ enum: PostStatus, description: 'Admin only' })
  @IsEnum(PostStatus)
  @IsOptional()
  status?: PostStatus;
}

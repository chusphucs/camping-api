import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { BlogService } from './blog.service';
import { BlogQueryDto } from './dto/blog-query.dto';

@ApiTags('blog')
@Controller('blog')
export class BlogController {
  constructor(private readonly blog: BlogService) {}

  /** Public: list of published posts. */
  @Get()
  list(@Query() query: BlogQueryDto) {
    return this.blog.publicList(query);
  }

  @Get(':slug')
  getBySlug(@Param('slug') slug: string) {
    return this.blog.publicGetBySlug(slug);
  }
}

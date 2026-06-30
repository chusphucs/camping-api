import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AdminAuthGuard } from '../auth/guards/admin-auth.guard';
import { BlogService } from './blog.service';
import { BlogQueryDto } from './dto/blog-query.dto';
import { CreateBlogDto } from './dto/create-blog.dto';
import { UpdateBlogDto } from './dto/update-blog.dto';

@ApiTags('admin/blog')
@ApiBearerAuth()
@UseGuards(AdminAuthGuard)
@Controller('admin/blog')
export class AdminBlogController {
  constructor(private readonly blog: BlogService) {}

  @Get()
  list(@Query() query: BlogQueryDto) {
    return this.blog.adminList(query);
  }

  @Get(':id')
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.blog.adminGet(id);
  }

  @Post()
  create(@Body() dto: CreateBlogDto) {
    return this.blog.create(dto);
  }

  @Patch(':id')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateBlogDto) {
    return this.blog.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.blog.remove(id);
  }
}

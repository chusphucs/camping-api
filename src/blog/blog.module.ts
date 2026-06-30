import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AdminBlogController } from './admin-blog.controller';
import { BlogController } from './blog.controller';
import { BlogService } from './blog.service';

@Module({
  imports: [AuthModule],
  controllers: [BlogController, AdminBlogController],
  providers: [BlogService],
  exports: [BlogService],
})
export class BlogModule {}

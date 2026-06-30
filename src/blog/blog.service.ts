import { Injectable } from '@nestjs/common';
import { ApiErrors } from '../common/errors/api-exception';
import { throwDbError } from '../common/errors/db-error';
import {
  buildMeta,
  Paginated,
  pageRange,
} from '../common/dto/pagination-query.dto';
import { PostStatus } from '../common/types/enums';
import { SupabaseService } from '../supabase/supabase.service';
import { BlogQueryDto } from './dto/blog-query.dto';
import { CreateBlogDto } from './dto/create-blog.dto';
import { UpdateBlogDto } from './dto/update-blog.dto';

@Injectable()
export class BlogService {
  constructor(private readonly supabase: SupabaseService) {}

  /** Public: published posts only. */
  async publicList(query: BlogQueryDto): Promise<Paginated<any>> {
    const { from, to } = pageRange(query.page, query.pageSize);
    let builder = this.supabase.db
      .from('blog_posts')
      .select(
        'id,title,excerpt,slug,cover_image_url,tags,author,published_at',
        {
          count: 'exact',
        },
      )
      .eq('status', PostStatus.PUBLISHED)
      .order('published_at', { ascending: false })
      .range(from, to);
    if (query.tag) builder = builder.contains('tags', [query.tag]);

    const { data, error, count } = await builder;
    if (error) throwDbError(error);
    return {
      data: data ?? [],
      meta: buildMeta(query.page, query.pageSize, count ?? 0),
    };
  }

  async publicGetBySlug(slug: string) {
    const { data, error } = await this.supabase.db
      .from('blog_posts')
      .select('*')
      .eq('slug', slug)
      .eq('status', PostStatus.PUBLISHED)
      .maybeSingle();
    if (error) throwDbError(error);
    if (!data) throw ApiErrors.notFound('Post not found');
    return data;
  }

  // ----- Admin -----
  async adminList(query: BlogQueryDto): Promise<Paginated<any>> {
    const { from, to } = pageRange(query.page, query.pageSize);
    let builder = this.supabase.db
      .from('blog_posts')
      .select(
        'id,title,excerpt,slug,status,cover_image_url,tags,author,published_at,updated_at',
        {
          count: 'exact',
        },
      )
      .order('updated_at', { ascending: false })
      .range(from, to);
    if (query.status) builder = builder.eq('status', query.status);

    const { data, error, count } = await builder;
    if (error) throwDbError(error);
    return {
      data: data ?? [],
      meta: buildMeta(query.page, query.pageSize, count ?? 0),
    };
  }

  async adminGet(id: string) {
    const { data, error } = await this.supabase.db
      .from('blog_posts')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (error) throwDbError(error);
    if (!data) throw ApiErrors.notFound('Post not found');
    return data;
  }

  async create(dto: CreateBlogDto) {
    const status = dto.status ?? PostStatus.DRAFT;
    const { data, error } = await this.supabase.db
      .from('blog_posts')
      .insert({
        title: dto.title,
        excerpt: dto.excerpt ?? { vi: '', en: '' },
        body: dto.body ?? { vi: '', en: '' },
        slug: dto.slug,
        status,
        cover_image_url: dto.coverImageUrl ?? null,
        tags: dto.tags ?? [],
        author: dto.author ?? null,
        published_at:
          status === PostStatus.PUBLISHED ? new Date().toISOString() : null,
      })
      .select()
      .single();
    if (error) throwDbError(error);
    return data;
  }

  async update(id: string, dto: UpdateBlogDto) {
    const existing = await this.adminGet(id);
    const patch: Record<string, unknown> = {};
    if (dto.title !== undefined) patch.title = dto.title;
    if (dto.excerpt !== undefined) patch.excerpt = dto.excerpt;
    if (dto.body !== undefined) patch.body = dto.body;
    if (dto.slug !== undefined) patch.slug = dto.slug;
    if (dto.coverImageUrl !== undefined)
      patch.cover_image_url = dto.coverImageUrl;
    if (dto.tags !== undefined) patch.tags = dto.tags;
    if (dto.author !== undefined) patch.author = dto.author;
    if (dto.status !== undefined) {
      patch.status = dto.status;
      // Stamp published_at the first time it becomes PUBLISHED.
      if (dto.status === PostStatus.PUBLISHED && !existing.published_at) {
        patch.published_at = new Date().toISOString();
      }
    }

    const { data, error } = await this.supabase.db
      .from('blog_posts')
      .update(patch)
      .eq('id', id)
      .select()
      .single();
    if (error) throwDbError(error);
    return data;
  }

  async remove(id: string) {
    const { error } = await this.supabase.db
      .from('blog_posts')
      .delete()
      .eq('id', id);
    if (error) throwDbError(error);
    return { success: true };
  }
}

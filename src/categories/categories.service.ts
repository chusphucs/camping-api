import { Injectable } from '@nestjs/common';
import { ApiErrors } from '../common/errors/api-exception';
import { throwDbError } from '../common/errors/db-error';
import { SupabaseService } from '../supabase/supabase.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';

@Injectable()
export class CategoriesService {
  constructor(private readonly supabase: SupabaseService) {}

  async list(includeInactive = false) {
    let query = this.supabase.db
      .from('categories')
      .select('*')
      .order('sort_order', { ascending: true });
    if (!includeInactive) query = query.eq('is_active', true);
    const { data, error } = await query;
    if (error) throwDbError(error);
    return data;
  }

  async create(dto: CreateCategoryDto) {
    const { data, error } = await this.supabase.db
      .from('categories')
      .insert({
        name: dto.name,
        slug: dto.slug,
        is_active: dto.isActive ?? true,
        sort_order: dto.sortOrder ?? 0,
      })
      .select()
      .single();
    if (error) throwDbError(error);
    return data;
  }

  async update(id: string, dto: UpdateCategoryDto) {
    const patch: Record<string, unknown> = {};
    if (dto.name !== undefined) patch.name = dto.name;
    if (dto.slug !== undefined) patch.slug = dto.slug;
    if (dto.isActive !== undefined) patch.is_active = dto.isActive;
    if (dto.sortOrder !== undefined) patch.sort_order = dto.sortOrder;

    const { data, error } = await this.supabase.db
      .from('categories')
      .update(patch)
      .eq('id', id)
      .select()
      .single();
    if (error) throwDbError(error);
    if (!data) throw ApiErrors.notFound('Category not found');
    return data;
  }

  async remove(id: string) {
    const { error } = await this.supabase.db
      .from('categories')
      .delete()
      .eq('id', id);
    if (error) throwDbError(error);
    return { success: true };
  }
}

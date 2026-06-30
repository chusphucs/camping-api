import { Injectable } from '@nestjs/common';
import { ApiErrors } from '../common/errors/api-exception';
import { throwDbError } from '../common/errors/db-error';
import {
  buildMeta,
  Paginated,
  pageRange,
  parseSort,
} from '../common/dto/pagination-query.dto';
import { SupabaseService } from '../supabase/supabase.service';
import { CreateProductDto } from './dto/create-product.dto';
import { ProductQueryDto } from './dto/product-query.dto';
import { UpdateProductDto } from './dto/update-product.dto';

const PRODUCT_SELECT =
  '*, category:categories(id,slug,name,is_active), images:product_images(id,url,alt,sort_order)';

const SORTABLE = ['created_at', 'daily_rate'];

@Injectable()
export class ProductsService {
  constructor(private readonly supabase: SupabaseService) {}

  /** Public/admin product list with filters, pagination and optional availability. */
  async list(
    query: ProductQueryDto,
    opts: { includeInactive?: boolean } = {},
  ): Promise<Paginated<any>> {
    const { from, to } = pageRange(query.page, query.pageSize);
    const sort = parseSort(query.sort, SORTABLE, {
      column: 'created_at',
      ascending: false,
    });

    let builder = this.supabase.db
      .from('products')
      .select(PRODUCT_SELECT, { count: 'exact' });

    if (!opts.includeInactive) builder = builder.eq('is_active', true);

    if (query.categorySlug) {
      const categoryId = await this.categoryIdBySlug(query.categorySlug);
      // Unknown slug -> no results rather than an error.
      builder = builder.eq(
        'category_id',
        categoryId ?? '00000000-0000-0000-0000-000000000000',
      );
    }

    if (query.q) {
      const safe = query.q.replace(/[%,()]/g, ' ').trim();
      if (safe) {
        builder = builder.or(
          `name->>vi.ilike.*${safe}*,name->>en.ilike.*${safe}*`,
        );
      }
    }

    builder = builder
      .order(sort.column, { ascending: sort.ascending })
      .range(from, to);

    const { data, error, count } = await builder;
    if (error) throwDbError(error);

    let rows = data ?? [];
    if (query.start && query.end) {
      rows = await this.annotateAvailability(rows, query.start, query.end);
    }

    return {
      data: rows,
      meta: buildMeta(query.page, query.pageSize, count ?? 0),
    };
  }

  async getBySlug(slug: string, opts: { includeInactive?: boolean } = {}) {
    let builder = this.supabase.db
      .from('products')
      .select(PRODUCT_SELECT)
      .eq('slug', slug);
    if (!opts.includeInactive) builder = builder.eq('is_active', true);

    const { data, error } = await builder.maybeSingle();
    if (error) throwDbError(error);
    if (!data) throw ApiErrors.productNotFound();
    return data;
  }

  async getById(id: string) {
    const { data, error } = await this.supabase.db
      .from('products')
      .select(PRODUCT_SELECT)
      .eq('id', id)
      .maybeSingle();
    if (error) throwDbError(error);
    if (!data) throw ApiErrors.productNotFound();
    return data;
  }

  async create(dto: CreateProductDto) {
    const { data, error } = await this.supabase.db
      .from('products')
      .insert(this.toRow(dto))
      .select(PRODUCT_SELECT)
      .single();
    if (error) throwDbError(error);
    return data;
  }

  async update(id: string, dto: UpdateProductDto) {
    const patch = this.toRow(dto, true);
    const { data, error } = await this.supabase.db
      .from('products')
      .update(patch)
      .eq('id', id)
      .select(PRODUCT_SELECT)
      .maybeSingle();
    if (error) throwDbError(error);
    if (!data) throw ApiErrors.productNotFound();
    return data;
  }

  async remove(id: string) {
    const { error } = await this.supabase.db
      .from('products')
      .delete()
      .eq('id', id);
    // FK violation (product referenced by a booking) -> 409; deactivate instead.
    if (error) throwDbError(error);
    return { success: true };
  }

  // ----- Images -----
  async uploadImage(productId: string, file: Express.Multer.File) {
    if (!file) throw ApiErrors.validation('No file uploaded');
    await this.getById(productId); // 404 if missing

    const ext = (file.originalname.split('.').pop() ?? 'jpg').toLowerCase();
    const path = `${productId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

    const { error: uploadError } = await this.supabase.db.storage
      .from('product-images')
      .upload(path, file.buffer, { contentType: file.mimetype, upsert: false });
    if (uploadError) throw ApiErrors.internal(uploadError.message);

    const { data: pub } = this.supabase.db.storage
      .from('product-images')
      .getPublicUrl(path);

    const { data, error } = await this.supabase.db
      .from('product_images')
      .insert({
        product_id: productId,
        url: pub.publicUrl,
        alt: file.originalname,
      })
      .select()
      .single();
    if (error) throwDbError(error);
    return data;
  }

  async removeImage(productId: string, imageId: string) {
    const { error } = await this.supabase.db
      .from('product_images')
      .delete()
      .eq('id', imageId)
      .eq('product_id', productId);
    if (error) throwDbError(error);
    return { success: true };
  }

  // ----- helpers -----
  private async categoryIdBySlug(slug: string): Promise<string | null> {
    const { data } = await this.supabase.db
      .from('categories')
      .select('id')
      .eq('slug', slug)
      .maybeSingle();
    return data?.id ?? null;
  }

  private async annotateAvailability(rows: any[], start: string, end: string) {
    const { data, error } = await this.supabase.db.rpc('available_quantities', {
      p_start_date: start,
      p_end_date: end,
    });
    if (error) return rows; // availability is best-effort for the catalog
    const map = new Map<string, number>(
      (data ?? []).map((r: any) => [r.product_id, r.available_quantity]),
    );
    return rows.map((p) => ({
      ...p,
      availableQuantity: map.get(p.id) ?? p.inventory_quantity,
    }));
  }

  private toRow(dto: Partial<CreateProductDto>, partial = false) {
    const row: Record<string, unknown> = {};
    if (dto.name !== undefined) row.name = dto.name;
    if (dto.description !== undefined) row.description = dto.description;
    if (dto.slug !== undefined) row.slug = dto.slug;
    if (dto.categoryId !== undefined) row.category_id = dto.categoryId;
    if (dto.dailyRate !== undefined) row.daily_rate = dto.dailyRate;
    if (dto.inventoryQuantity !== undefined)
      row.inventory_quantity = dto.inventoryQuantity;
    if (dto.isActive !== undefined) row.is_active = dto.isActive;
    if (!partial && row.description === undefined)
      row.description = { vi: '', en: '' };
    return row;
  }
}

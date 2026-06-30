import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class PaginationQueryDto {
  @ApiPropertyOptional({ default: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  page: number = 1;

  @ApiPropertyOptional({ default: 12, maximum: 100 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  pageSize: number = 12;

  @ApiPropertyOptional({ example: 'created_at.desc' })
  @IsString()
  @IsOptional()
  sort?: string;
}

export interface PageMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface Paginated<T> {
  data: T[];
  meta: PageMeta;
}

export function buildMeta(
  page: number,
  pageSize: number,
  total: number,
): PageMeta {
  return {
    page,
    pageSize,
    total,
    totalPages: pageSize > 0 ? Math.ceil(total / pageSize) : 0,
  };
}

/** Inclusive [from, to] range for supabase `.range()`. */
export function pageRange(page: number, pageSize: number) {
  const from = (page - 1) * pageSize;
  return { from, to: from + pageSize - 1 };
}

const SORTABLE_DIRECTIONS = new Set(['asc', 'desc']);

/** Parse `column.direction` against a whitelist; falls back to a default. */
export function parseSort(
  sort: string | undefined,
  allowed: string[],
  fallback: { column: string; ascending: boolean },
): { column: string; ascending: boolean } {
  if (!sort) return fallback;
  const [column, direction = 'asc'] = sort.split('.');
  if (!allowed.includes(column) || !SORTABLE_DIRECTIONS.has(direction)) {
    return fallback;
  }
  return { column, ascending: direction === 'asc' };
}

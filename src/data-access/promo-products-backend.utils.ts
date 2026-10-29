import { HttpParams } from '@angular/common/http';

import type {
  IPromoProduct,
  IPromoProductDto,
  IPromoProductsPage,
  IPromoProductsQuery,
  IPromoProductsResponse,
  ITag,
  TPromoProductTagsResponse,
} from '../promo-products.interface';

export function toProductTags(response: TPromoProductTagsResponse | null): readonly ITag[] {
  if (!response) {
    return [];
  }

  return isTagList(response) ? response : (response.tags ?? []);
}

/** `Array.isArray` не сужает readonly-массив, поэтому предикат написан явно. */
function isTagList(response: TPromoProductTagsResponse): response is readonly ITag[] {
  return Array.isArray(response);
}

export function toProductsPage(response: IPromoProductsResponse): IPromoProductsPage {
  const items = response.items ?? [];

  return {
    items: items.map(toPromoProduct),
    totalCount: response.totalCount ?? response.pagination?.total ?? items.length,
  };
}

/** Пустые значения в адрес не попадают: пустой поиск или тег — это отсутствие фильтра, а не фильтр по пустой строке. */
export function toHttpParams({
  page,
  limit,
  search,
  tags,
  excludeTags,
  inStockOnly,
  sortBy,
}: Omit<IPromoProductsQuery, 'campaignId'>): HttpParams {
  let params = new HttpParams();

  if (page && page > 0) {
    params = params.set('page', page);
  }

  if (limit && limit > 0) {
    params = params.set('limit', limit);
  }

  const normalizedSearch = search?.trim();

  if (normalizedSearch) {
    params = params.set('search', normalizedSearch);
  }

  for (const tag of tags ?? []) {
    if (tag) {
      params = params.append('tags', tag);
    }
  }

  for (const tag of excludeTags ?? []) {
    if (tag) {
      params = params.append('excludeTags', tag);
    }
  }

  // Без параметра ручка отдаёт и товары без остатка, поэтому выбор шлём явно в обе стороны.
  if (inStockOnly !== undefined) {
    params = params.set('inStockOnly', inStockOnly);
  }

  if (sortBy) {
    params = params.set('sortBy', sortBy);
  }

  return params;
}

function toPromoProduct(dto: IPromoProductDto): IPromoProduct {
  return {
    id: dto.id,
    sku: dto.sku,
    name: dto.title,
    regularPrice: dto.regular_price,
    promoPrice: dto.promo_price,
    stock: dto.stock_qty,
    isPinned: dto.is_pinned ?? false,
  };
}

import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';

import type { Observable } from 'rxjs';
import { map } from 'rxjs';

import { toHttpParams, toProductsPage, toProductTags } from './promo-products-backend.utils';

import type {
  IPromoProductsPage,
  IPromoProductsQuery,
  IPromoProductsResponse,
  IPromoProductsSlice,
  ITag,
  TPromoProductTagsResponse,
} from '../promo-products.interface';

/**
 * HTTP-транспорт товаров акции: сначала закреплённые маркетологом, затем остальные по сортировке.
 * Видимость, остатки и ассортимент магазина применяет бэкенд — клиент страницу не режет и не сортирует.
 */
@Injectable({ providedIn: 'root' })
export class PromoProductsBackendService {
  readonly #http = inject(HttpClient);

  getProducts({ campaignId, ...filters }: IPromoProductsQuery): Observable<IPromoProductsPage> {
    return this.#http
      .get<IPromoProductsResponse>(`/promo-campaigns/${encodeURIComponent(campaignId)}/products`, {
        params: toHttpParams(filters),
      })
      .pipe(map(toProductsPage));
  }

  /**
   * Теги для панели фильтров. Фильтры уходят те же, что и в выдачу, кроме страницы, лимита и
   * сортировки: состав выдачи они не меняют, а всё остальное меняет — вместе с `count` тегов.
   */
  getProductTags({ campaignId, ...filters }: IPromoProductsSlice): Observable<readonly ITag[]> {
    return this.#http
      .get<TPromoProductTagsResponse>(`/promo-campaigns/${encodeURIComponent(campaignId)}/products/tags`, {
        params: toHttpParams(filters),
      })
      .pipe(map(toProductTags));
  }
}

import type { IPromoProduct, ITag } from '../promo-products.interface';

export interface IKnownTotal {
  readonly sliceKey: string;
  readonly count: number;
}

export interface IPromoProductsState {
  products: readonly IPromoProduct[];
  /** Размер всей выдачи по фильтрам, а не текущей страницы: из него считается пагинация. */
  totalCount: number;
  /**
   * Размер последней успешной выдачи и срез, к которому он относится: по нему ограничивается номер
   * следующей страницы. Размер другого среза о текущем ничего не говорит, поэтому храним их вместе.
   */
  knownTotal: IKnownTotal | null;
  campaignId: string | null;
  /** Параметры последнего запроса — по ним отсеиваются повторные загрузки той же страницы. */
  queryKey: string | null;
  loading: boolean;
  loaded: boolean;
  /** В отличие от loaded, живёт до смены акции, а не до следующего запроса, и учитывает завершившиеся ошибки. */
  hasCompletedRequest: boolean;
  /** Текст ошибки, а не сам объект: в сторе лежат только данные, которые можно показать и сравнить. */
  error: string | null;
  /** Теги товаров акции: своя ручка, поэтому и своё состояние рядом с выдачей. */
  tags: readonly ITag[];
  /** Ключ последнего запроса тегов: те же фильтры, что и у выдачи, кроме страницы, лимита и сортировки. */
  tagsQueryKey: string | null;
  tagsLoading: boolean;
  /** Как и hasCompletedRequest, живёт до смены акции: по нему панель рисует скелетон только раз. */
  hasCompletedTagsRequest: boolean;
  tagsError: string | null;
}

export const initialPromoProductsState: IPromoProductsState = {
  products: [],
  totalCount: 0,
  knownTotal: null,
  campaignId: null,
  queryKey: null,
  loading: false,
  loaded: false,
  hasCompletedRequest: false,
  error: null,
  tags: [],
  tagsQueryKey: null,
  tagsLoading: false,
  hasCompletedTagsRequest: false,
  tagsError: null,
};

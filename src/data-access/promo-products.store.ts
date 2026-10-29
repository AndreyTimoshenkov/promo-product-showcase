import { HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { updateState, withDevtools } from '@angular-architects/ngrx-toolkit';

import { signalStore, withMethods, withState } from '@ngrx/signals';
import { rxMethod } from '@ngrx/signals/rxjs-interop';
import { catchError, EMPTY, filter, map, pipe, switchMap, tap } from 'rxjs';

import { initialPromoProductsState } from './promo-products.model';
import { PromoProductsBackendService } from './promo-products-backend.service';

import type { IPromoProductsQuery, IPromoProductsSlice } from '../promo-products.interface';

/**
 * Ключи — структурная сериализация, а не склейка через разделитель: тег «Свежее, охлаждённое»
 * не должен совпасть с парой тегов «Свежее» и «охлаждённое». Регистр поиска сохраняем, как и в запросе.
 */
function toSliceKey({ campaignId, search = '', tags = [], excludeTags = [], inStockOnly }: IPromoProductsSlice): string {
  return JSON.stringify([campaignId, search.trim(), tags, excludeTags, inStockOnly ?? null]);
}

/** Ключ запроса — срез плюс то, что режет и переставляет его: новый фильтр достаточно добавить в срез. */
function toQueryKey(query: IPromoProductsQuery): string {
  const { page = 1, limit = 0, sortBy } = query;

  return JSON.stringify([toSliceKey(query), page, limit, sortBy ?? null]);
}

function toErrorMessage(error: unknown): string {
  return error instanceof HttpErrorResponse || error instanceof Error ? error.message : String(error);
}

/**
 * Стор без `providedIn`: его инстанс живёт и умирает вместе с компонентом-владельцем, поэтому
 * две выдачи одной акции на разных экранах не перетирают друг другу страницу и фильтры.
 */
export const PromoProductsStore = signalStore(
  withDevtools('promo-products'),
  withState(initialPromoProductsState),
  withMethods((store, service = inject(PromoProductsBackendService)) => {
    // Акцию последнего запроса тегов ведём отдельно от `campaignId`: тот выставляет `load`,
    // а теги грузятся своим потоком и могут опередить выдачу.
    let tagsCampaignId: string | null = null;

    /**
     * Теги панели фильтров: отдельный от `load` поток со своей ручкой. Повтор запроса с тем же
     * ключом отсеивается здесь, поэтому перезагрузка того же списка идёт через `reloadTags`.
     */
    const loadTags = rxMethod<IPromoProductsSlice>(
      pipe(
        filter((query) => store.tagsQueryKey() !== toSliceKey(query)),
        switchMap((query) => {
          const isSameCampaign = tagsCampaignId === query.campaignId;
          tagsCampaignId = query.campaignId;

          updateState(store, '[Promo Products] Tags: Load', {
            tagsQueryKey: toSliceKey(query),
            tagsLoading: true,
            tagsError: null,
            // Теги прошлой акции к новой не относятся — убираем сразу, до ответа, и вместе
            // с ними отметку о завершённом запросе: под новый список панель снова рисует скелетон.
            ...(isSameCampaign ? {} : { tags: [], hasCompletedTagsRequest: false }),
          });

          return service.getProductTags(query).pipe(
            catchError((error: unknown) => {
              // Ключ сбрасываем, иначе `filter` выше не пропустит повтор того же запроса по «Повторить».
              updateState(store, '[Promo Products] Tags: Load Failure', {
                tags: [],
                tagsQueryKey: null,
                tagsLoading: false,
                hasCompletedTagsRequest: true,
                tagsError: toErrorMessage(error),
              });
              return EMPTY;
            }),
          );
        }),
        tap((tags) => {
          updateState(store, '[Promo Products] Tags: Load Success', {
            tags,
            tagsLoading: false,
            hasCompletedTagsRequest: true,
            tagsError: null,
          });
        }),
      ),
    );

    return {
      load: rxMethod<IPromoProductsQuery>(
        pipe(
          filter((query) => !(store.queryKey() === toQueryKey(query) && (store.loading() || store.loaded()))),
          switchMap((query) => {
            const isSameCampaign = store.campaignId() === query.campaignId;

            updateState(store, '[Promo Products] Products: Load', {
              campaignId: query.campaignId,
              queryKey: toQueryKey(query),
              loading: true,
              loaded: false,
              error: null,
              // При повторном запросе прошлая страница остаётся в сторе: таблица показывает её полупрозрачной до ответа.
              // Выдача другой акции к странице уже не относится: сбрасываем её вместе с размером и
              // отметкой о первой загрузке, иначе компонент ограничил бы страницу размером чужой выдачи.
              ...(isSameCampaign ? {} : { products: [], totalCount: 0, knownTotal: null, hasCompletedRequest: false }),
            });

            // `switchMap` отписывается от прошлого запроса, поэтому ответ и ошибка ниже всегда относятся к последнему.
            return service.getProducts(query).pipe(
              map((page) => ({ page, sliceKey: toSliceKey(query) })),
              catchError((error: unknown) => {
                updateState(store, '[Promo Products] Products: Load Failure', {
                  products: [],
                  totalCount: 0,
                  loading: false,
                  loaded: false,
                  hasCompletedRequest: true,
                  error: toErrorMessage(error),
                });
                return EMPTY;
              }),
            );
          }),
          tap(({ page, sliceKey }) => {
            updateState(store, '[Promo Products] Products: Load Success', {
              products: page.items,
              totalCount: page.totalCount,
              knownTotal: { sliceKey, count: page.totalCount },
              loading: false,
              loaded: true,
              hasCompletedRequest: true,
              error: null,
            });
          }),
        ),
      ),
      loadTags,
      /** Размер выдачи по этому срезу, если он уже известен; для любого другого среза — `null`. */
      knownTotalCountFor(slice: IPromoProductsSlice): number | null {
        const knownTotal = store.knownTotal();

        return knownTotal?.sliceKey === toSliceKey(slice) ? knownTotal.count : null;
      },
      /**
       * Перезагрузка списка теми же параметрами: сама `loadTags` отсеяла бы повтор по ключу.
       * Нужна на «Повторить» в панели после ошибки.
       */
      reloadTags(query: IPromoProductsSlice): void {
        updateState(store, '[Promo Products] Tags: Reload', { tagsQueryKey: null, tagsError: null });
        loadTags(query);
      },
    };
  }),
);

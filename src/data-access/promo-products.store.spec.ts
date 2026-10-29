import { TestBed } from '@angular/core/testing';

import { of, Subject, throwError } from 'rxjs';

import { PromoProductsStore } from './promo-products.store';
import { PromoProductsBackendService } from './promo-products-backend.service';

import type { IPromoProduct, IPromoProductsPage, ITag } from '../promo-products.interface';

function createProduct(id: string): IPromoProduct {
  return { id, sku: `SKU-${id}`, name: `Product ${id}`, regularPrice: 10_000, promoPrice: 7_990, stock: 5, isPinned: false };
}

const PRODUCTS = ['p-1', 'p-2', 'p-3', 'p-4'].map(createProduct);

describe('PromoProductsStore', () => {
  let store: InstanceType<typeof PromoProductsStore>;
  let getProducts: jest.Mock;
  let getProductTags: jest.Mock;

  beforeEach(() => {
    getProducts = jest.fn();
    getProductTags = jest.fn();
    TestBed.configureTestingModule({
      providers: [PromoProductsStore, { provide: PromoProductsBackendService, useValue: { getProducts, getProductTags } }],
    });
    store = TestBed.inject(PromoProductsStore);
  });

  it('skips a repeated request for the same page', () => {
    getProducts.mockReturnValue(of({ items: PRODUCTS, totalCount: PRODUCTS.length }));

    store.load({ campaignId: 'promo-1', page: 1, limit: 4 });
    store.load({ campaignId: 'promo-1', page: 1, limit: 4, search: '  ' });

    expect(getProducts).toHaveBeenCalledTimes(1);
    expect(store.products()).toEqual(PRODUCTS);
  });

  it('does not let an older response overwrite the latest search result', () => {
    const olderPage$ = new Subject<IPromoProductsPage>();
    const latestPage$ = new Subject<IPromoProductsPage>();
    const latestProducts = [createProduct('latest')];
    const latestQuery = { campaignId: 'promo-1', search: 'milk' };
    getProducts.mockReturnValueOnce(olderPage$).mockReturnValueOnce(latestPage$);

    store.load({ campaignId: 'promo-1', search: 'bread' });
    store.load(latestQuery);

    expect(store.loading()).toBe(true);

    latestPage$.next({ items: latestProducts, totalCount: 12 });
    latestPage$.complete();

    expect(store.products()).toEqual(latestProducts);

    olderPage$.next({ items: PRODUCTS, totalCount: 100 });
    olderPage$.complete();

    expect(store.products()).toEqual(latestProducts);
    expect(store.totalCount()).toBe(12);
    expect(store.knownTotalCountFor(latestQuery)).toBe(12);
    expect(store.loading()).toBe(false);
    expect(store.loaded()).toBe(true);
    expect(store.error()).toBeNull();
  });

  it('keeps initial loading complete while a later empty result is loading', () => {
    getProducts.mockReturnValueOnce(of({ items: PRODUCTS, totalCount: PRODUCTS.length }));
    store.load({ campaignId: 'promo-1', page: 1, limit: 4 });

    const emptyPage$ = new Subject<{ items: []; totalCount: number }>();
    getProducts.mockReturnValueOnce(emptyPage$);
    store.load({ campaignId: 'promo-1', page: 1, limit: 4, search: 'missing' });

    expect(store.loading()).toBe(true);
    expect(store.hasCompletedRequest()).toBe(true);
    // Та же акция: прошлая страница остаётся под скелетоном, пока не придёт новая.
    expect(store.products()).toEqual(PRODUCTS);

    emptyPage$.next({ items: [], totalCount: 0 });
    emptyPage$.complete();

    expect(store.products()).toEqual([]);
  });

  it('drops the previous campaign products before the new ones arrive', () => {
    getProducts.mockReturnValueOnce(of({ items: PRODUCTS, totalCount: PRODUCTS.length }));
    store.load({ campaignId: 'promo-1', page: 1, limit: 4 });

    getProducts.mockReturnValueOnce(new Subject());
    store.load({ campaignId: 'promo-2', page: 1, limit: 4 });

    const { products, knownTotal, hasCompletedRequest } = store;

    expect({ products: products(), knownTotal: knownTotal(), hasCompletedRequest: hasCompletedRequest() }).toEqual({
      products: [],
      knownTotal: null,
      hasCompletedRequest: false,
    });
  });

  it('knows the total only for the slice that produced it', () => {
    getProducts.mockReturnValue(of({ items: PRODUCTS, totalCount: 30 }));
    store.load({ campaignId: 'promo-1', tags: ['Выпечка'], page: 1, limit: 50 });

    // Страница, лимит и сортировка срез не меняют.
    expect(store.knownTotalCountFor({ campaignId: 'promo-1', tags: ['Выпечка'] })).toBe(30);
    expect(store.knownTotalCountFor({ campaignId: 'promo-1', tags: [] })).toBeNull();
    expect(store.knownTotalCountFor({ campaignId: 'promo-2', tags: ['Выпечка'] })).toBeNull();
  });

  it('does not treat a tag containing a comma as two tags', () => {
    getProducts.mockReturnValue(of({ items: PRODUCTS, totalCount: PRODUCTS.length }));

    store.load({ campaignId: 'promo-1', tags: ['Свежее, охлаждённое'] });
    store.load({ campaignId: 'promo-1', tags: ['Свежее', ' охлаждённое'] });

    expect(getProducts).toHaveBeenCalledTimes(2);
  });

  it('lets the same query be retried after a failure', () => {
    getProducts.mockReturnValueOnce(throwError(() => new Error('Request failed')));
    store.load({ campaignId: 'promo-1', page: 1, limit: 4 });

    getProducts.mockReturnValueOnce(of({ items: PRODUCTS, totalCount: PRODUCTS.length }));
    store.load({ campaignId: 'promo-1', page: 1, limit: 4 });

    expect(getProducts).toHaveBeenCalledTimes(2);
    expect(store.products()).toEqual(PRODUCTS);
    expect(store.error()).toBeNull();
  });

  it('clears the active query result after a request fails', () => {
    getProducts.mockReturnValueOnce(of({ items: PRODUCTS, totalCount: PRODUCTS.length }));
    store.load({ campaignId: 'promo-1', page: 1, limit: 4 });

    const error = new Error('Request failed');
    getProducts.mockReturnValueOnce(throwError(() => error));
    store.load({ campaignId: 'promo-1', page: 2, limit: 4 });

    expect(store.products()).toEqual([]);
    expect(store.totalCount()).toBe(0);
    expect(store.loading()).toBe(false);
    expect(store.loaded()).toBe(false);
    expect(store.hasCompletedRequest()).toBe(true);
    expect(store.error()).toBe('Request failed');
  });

  describe('tags', () => {
    const TAGS: ITag[] = [{ id: 'tag-1', name: 'Молочные продукты', count: 6 }];

    it('re-requests the same query only through reloadTags', () => {
      getProductTags.mockReturnValue(of(TAGS));

      store.loadTags({ campaignId: 'promo-1', inStockOnly: true });
      store.loadTags({ campaignId: 'promo-1', inStockOnly: true });
      expect(getProductTags).toHaveBeenCalledTimes(1);

      store.reloadTags({ campaignId: 'promo-1', inStockOnly: true });
      expect(getProductTags).toHaveBeenCalledTimes(2);
      expect(store.tags()).toEqual(TAGS);
      expect(store.tagsError()).toBeNull();
    });

    it('keys the tags request by the filters that change the result', () => {
      getProductTags.mockReturnValue(of(TAGS));

      store.loadTags({ campaignId: 'promo-1', search: '', tags: [], inStockOnly: true });
      store.loadTags({ campaignId: 'promo-1', search: 'молоко', tags: [], inStockOnly: true });
      store.loadTags({ campaignId: 'promo-1', search: 'молоко', tags: ['Молочные продукты'], inStockOnly: true });
      store.loadTags({ campaignId: 'promo-1', search: 'молоко', tags: ['Молочные продукты'], excludeTags: ['Детское'], inStockOnly: true });
      expect(getProductTags).toHaveBeenCalledTimes(4);

      // Тот же срез — тот же ключ: повтор в сеть не идёт.
      store.loadTags({ campaignId: 'promo-1', search: 'молоко', tags: ['Молочные продукты'], excludeTags: ['Детское'], inStockOnly: true });
      expect(getProductTags).toHaveBeenCalledTimes(4);
    });

    it('marks the tags request as completed so the panel skeleton shows only once', () => {
      getProductTags.mockReturnValue(of(TAGS));
      expect(store.hasCompletedTagsRequest()).toBe(false);

      store.loadTags({ campaignId: 'promo-1', inStockOnly: true });
      expect(store.hasCompletedTagsRequest()).toBe(true);

      // Та же акция: под перезапрос по новому фильтру панель скелетон уже не рисует.
      const nextTags$ = new Subject<typeof TAGS>();
      getProductTags.mockReturnValueOnce(nextTags$);
      store.loadTags({ campaignId: 'promo-1', search: 'молоко', inStockOnly: true });

      expect(store.tagsLoading()).toBe(true);
      expect(store.hasCompletedTagsRequest()).toBe(true);

      nextTags$.next(TAGS);
      nextTags$.complete();

      // Другая акция: её список ещё не загружен, поэтому панель возвращается к скелетону.
      getProductTags.mockReturnValueOnce(new Subject<typeof TAGS>());
      store.loadTags({ campaignId: 'promo-2', inStockOnly: true });

      expect(store.hasCompletedTagsRequest()).toBe(false);
      expect(store.tags()).toEqual([]);
    });

    it('lets reloadTags re-request the same query after a failure', () => {
      const error = new Error('Tags failed');
      getProductTags.mockReturnValueOnce(throwError(() => error));
      store.loadTags({ campaignId: 'promo-1', inStockOnly: true });

      expect(store.tags()).toEqual([]);
      expect(store.tagsLoading()).toBe(false);
      expect(store.tagsError()).toBe('Tags failed');

      getProductTags.mockReturnValueOnce(of(TAGS));
      store.reloadTags({ campaignId: 'promo-1', inStockOnly: true });

      expect(getProductTags).toHaveBeenCalledTimes(2);
      expect(store.tags()).toEqual(TAGS);
      expect(store.tagsError()).toBeNull();
    });
  });
});

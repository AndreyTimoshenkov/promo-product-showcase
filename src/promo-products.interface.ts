import type { ESortOption } from './promo-products.enum';

export interface ITag {
  readonly id: string;
  readonly name: string;
  /** Сколько товаров текущей выдачи несут тег — бэкенд считает по тому же срезу фильтров. */
  readonly count?: number;
}

export interface IPromoProduct {
  readonly id: string;
  readonly sku: string;
  readonly name: string;
  /** Цены в копейках: деньги на клиенте не складываем во float. */
  readonly regularPrice: number;
  readonly promoPrice: number;
  readonly stock: number;
  /** Товар, который маркетолог закрепил за акцией: такие идут первыми и получают бейдж. */
  readonly isPinned: boolean;
}

/** Ответ ручки как есть: размер выдачи приходит либо в `totalCount`, либо в `pagination.total`. */
export interface IPromoProductsResponse {
  readonly items?: readonly IPromoProductDto[];
  readonly totalCount?: number;
  readonly pagination?: { readonly total?: number };
}

export interface IPromoProductDto {
  readonly id: string;
  readonly sku: string;
  readonly title: string;
  readonly regular_price: number;
  readonly promo_price: number;
  readonly stock_qty: number;
  readonly is_pinned?: boolean;
}

/** Ручка отдаёт теги либо массивом, либо в обёртке `{ tags }`. */
export type TPromoProductTagsResponse = readonly ITag[] | { readonly tags?: readonly ITag[] };

/**
 * Срез выдачи: фильтры, которые меняют её состав. По нему же считаются теги с их `count`
 * и размер выдачи — страница, лимит и сортировка только режут и переставляют тот же срез.
 */
export interface IPromoProductsSlice {
  /** Идентификатор или slug акции — ручка принимает оба. */
  readonly campaignId: string;
  readonly search?: string;
  /** Теги фильтруются по И: товар должен нести их все. */
  readonly tags?: readonly string[];
  /** Исключающие теги: товар не должен нести ни одного из них. */
  readonly excludeTags?: readonly string[];
  /** `true` прячет товары без остатка. */
  readonly inStockOnly?: boolean;
}

export interface IPromoProductsQuery extends IPromoProductsSlice {
  readonly page?: number;
  readonly limit?: number;
  readonly sortBy?: ESortOption;
}

export interface IPromoProductsPage {
  readonly items: readonly IPromoProduct[];
  /** Размер всей выдачи по фильтрам: из него клиент считает число страниц. */
  readonly totalCount: number;
}

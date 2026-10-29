import type { HttpEvent, HttpInterceptorFn, HttpRequest } from '@angular/common/http';
import { HttpErrorResponse, HttpResponse } from '@angular/common/http';

import type { Observable } from 'rxjs';
import { mergeMap, of, throwError, timer } from 'rxjs';

import type { IPromoProductDto, IPromoProductsResponse, ITag } from '../src/promo-products.interface';

/**
 * Демо-бэкенд в браузере. Отвечает на две ручки фичи так, как их описывает контракт в `src/`:
 * фильтры, сортировка и страницы считаются здесь, а клиент получает готовую страницу.
 * Задержка нарочно заметная, чтобы были видны скелетоны и полупрозрачная прошлая страница.
 */

interface IDemoProduct extends IPromoProductDto {
  readonly tags: readonly string[];
  readonly sales: number;
  readonly createdAt: number;
}

const PRODUCTS_DELAY_MS = 600;
const TAGS_DELAY_MS = 350;
const ROUTE = /^\/promo-campaigns\/([^/]+)\/products(\/tags)?$/;

const CATALOG: Readonly<Record<string, readonly string[]>> = {
  'Молочные продукты': ['Молоко 3,2%', 'Кефир 1%', 'Творог 5%', 'Йогурт клубничный', 'Сыр «Российский»', 'Сметана 20%', 'Ряженка'],
  Выпечка: ['Батон нарезной', 'Круассан', 'Хлеб бородинский', 'Багет', 'Пирожок с капустой', 'Маффин шоколадный'],
  'Овощи и фрукты': ['Яблоки «Гала»', 'Бананы', 'Огурцы', 'Томаты черри', 'Картофель', 'Апельсины', 'Морковь'],
  Мясо: ['Филе куриное', 'Фарш говяжий', 'Свинина шейка', 'Индейка бедро', 'Колбаса докторская'],
  Напитки: ['Сок апельсиновый', 'Вода минеральная', 'Морс клюквенный', 'Чай чёрный', 'Кофе молотый'],
  Детское: ['Пюре яблочное', 'Каша гречневая', 'Печенье детское', 'Сок для детей'],
  Заморозка: ['Пельмени', 'Мороженое пломбир', 'Овощная смесь', 'Вареники с картофелем'],
  Бакалея: ['Гречка', 'Рис длиннозёрный', 'Макароны', 'Мука пшеничная', 'Сахар', 'Масло подсолнечное'],
};
const EXTRA_TAGS = ['Свежее, охлаждённое', 'Без сахара', 'Эко', 'Собственная марка'];
const BRANDS = ['Ферма у дома', 'Простые продукты', 'Вкусный день', 'Северное поле', 'Зелёная долина'];

const CAMPAIGNS: Readonly<Record<string, readonly IDemoProduct[]>> = {
  'summer-sale': generateProducts(320, 7),
  'back-to-school': generateProducts(140, 42),
};

export const mockBackendInterceptor: HttpInterceptorFn = (request, next) => {
  const match = ROUTE.exec(request.url);

  if (!match || request.method !== 'GET') {
    return next(request);
  }

  const [, campaignId, tagsSuffix] = match;
  const products = CAMPAIGNS[campaignId];

  if (tagsSuffix) {
    // Вторая акция отдаёт теги в обёртке `{ tags }`: клиент обязан понимать обе формы ответа.
    const tags = toTags(filterSlice(products ?? [], request));
    return respond(request, campaignId === 'back-to-school' ? { tags } : tags, TAGS_DELAY_MS);
  }

  if (!products) {
    return fail(request, campaignId === 'broken' ? 500 : 404);
  }

  return respond(request, toPage(products, request), PRODUCTS_DELAY_MS);
};

function toPage(products: readonly IDemoProduct[], request: HttpRequest<unknown>): IPromoProductsResponse {
  const page = Math.max(1, Number(request.params.get('page') ?? 1));
  const limit = Math.max(1, Number(request.params.get('limit') ?? 50));
  const sorted = sortProducts(filterSlice(products, request), request.params.get('sortBy'));

  return {
    items: sorted.slice((page - 1) * limit, page * limit).map(toDto),
    totalCount: sorted.length,
  };
}

function filterSlice(products: readonly IDemoProduct[], request: HttpRequest<unknown>): IDemoProduct[] {
  const search = request.params.get('search')?.toLowerCase() ?? '';
  const tags = request.params.getAll('tags') ?? [];
  const excludeTags = request.params.getAll('excludeTags') ?? [];
  const inStockOnly = request.params.get('inStockOnly') === 'true';

  return products.filter(
    (product) =>
      (!search || product.title.toLowerCase().includes(search) || product.sku.includes(search)) &&
      tags.every((tag) => product.tags.includes(tag)) &&
      !excludeTags.some((tag) => product.tags.includes(tag)) &&
      (!inStockOnly || product.stock_qty > 0),
  );
}

/** Закреплённые маркетологом всегда идут первыми, остальные — по выбранной сортировке. */
function sortProducts(products: IDemoProduct[], sortBy: string | null): IDemoProduct[] {
  const discount = (product: IDemoProduct): number => 1 - product.promo_price / product.regular_price;
  const compare: Record<string, (left: IDemoProduct, right: IDemoProduct) => number> = {
    best_selling: (left, right) => right.sales - left.sales,
    biggest_discount: (left, right) => discount(right) - discount(left),
    price_asc: (left, right) => left.promo_price - right.promo_price,
    price_desc: (left, right) => right.promo_price - left.promo_price,
    newest: (left, right) => right.createdAt - left.createdAt,
  };
  const bySort = compare[sortBy ?? ''] ?? ((): number => 0);

  return [...products].sort((left, right) => Number(right.is_pinned) - Number(left.is_pinned) || bySort(left, right));
}

function toTags(products: readonly IDemoProduct[]): ITag[] {
  const counts = new Map<string, number>();

  for (const tag of products.flatMap((product) => product.tags)) {
    counts.set(tag, (counts.get(tag) ?? 0) + 1);
  }

  return [...counts.entries()]
    .sort(([left], [right]) => left.localeCompare(right, 'ru'))
    .map(([name, count]) => ({ id: name, name, count }));
}

function toDto({ id, sku, title, regular_price, promo_price, stock_qty, is_pinned }: IDemoProduct): IPromoProductDto {
  return { id, sku, title, regular_price, promo_price, stock_qty, is_pinned };
}

function respond<T>(request: HttpRequest<unknown>, body: T, delayMs: number): Observable<HttpEvent<T>> {
  return timer(delayMs).pipe(mergeMap(() => of(new HttpResponse({ status: 200, body, url: request.urlWithParams }))));
}

function fail(request: HttpRequest<unknown>, status: number): Observable<never> {
  const error = new HttpErrorResponse({
    status,
    statusText: status === 404 ? 'Not Found' : 'Internal Server Error',
    url: request.urlWithParams,
  });

  return timer(PRODUCTS_DELAY_MS).pipe(mergeMap(() => throwError(() => error)));
}

/** Детерминированный генератор: при каждой загрузке те же товары, поэтому ссылку на страницу можно повторить. */
function generateProducts(count: number, seed: number): IDemoProduct[] {
  let state = seed;
  const random = (): number => {
    state = (state * 1_103_515_245 + 12_345) % 2_147_483_648;
    return state / 2_147_483_648;
  };
  const pick = <T>(items: readonly T[]): T => items[Math.floor(random() * items.length)];
  const categories = Object.keys(CATALOG);

  return Array.from({ length: count }, (_, index) => {
    const category = pick(categories);
    const regularPrice = Math.round((49 + random() * 850) * 10) * 10;
    const discountPercent = random() < 0.15 ? 0 : Math.round(5 + random() * 40);
    const tags = [category, ...EXTRA_TAGS.filter(() => random() < 0.18)];

    return {
      id: `p-${seed}-${index + 1}`,
      sku: String(100_000 + seed * 1_000 + index),
      title: `${pick(CATALOG[category])}, ${pick(BRANDS)}`,
      regular_price: regularPrice,
      promo_price: Math.round((regularPrice * (100 - discountPercent)) / 100),
      stock_qty: random() < 0.15 ? 0 : Math.floor(random() * 60) + 1,
      is_pinned: index < 4,
      tags,
      sales: Math.floor(random() * 5_000),
      createdAt: Math.floor(random() * 1_000_000),
    };
  });
}

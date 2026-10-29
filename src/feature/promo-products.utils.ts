import type { ParamMap } from '@angular/router';

import { TAG_STATUS_LABELS } from './promo-products.const';
import type { IPromoProductRow, ITagWithStatus } from './promo-products.interface';

import { ETagStatus } from '../promo-products.enum';
import type { IPromoProduct, ITag } from '../promo-products.interface';

export function isSameList(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((item, index) => item === right[index]);
}

/** Страница из адреса: всё, что не положительное целое, — первая страница. */
export function toPage(params: ParamMap): number {
  const page = Number(params.get('page'));

  return Number.isInteger(page) && page > 0 ? page : 1;
}

/**
 * Страница для запроса. Пока размер выдачи неизвестен, доверяем адресу: открытая по ссылке пятая
 * страница сразу уходит в сеть пятой. Когда размер известен, не выходим за последнюю страницу.
 */
export function toRequestPage(requestedPage: number, knownTotalCount: number | null, pageSize: number): number {
  if (knownTotalCount === null) {
    return requestedPage;
  }

  return Math.min(requestedPage, Math.max(1, Math.ceil(knownTotalCount / pageSize)));
}

/** Цены приходят в копейках; скидка округляется до целого процента, как на ценнике, и не бывает нулевой или отрицательной. */
export function toRow(product: IPromoProduct): IPromoProductRow {
  const discountPercent = product.regularPrice > 0 ? Math.round((1 - product.promoPrice / product.regularPrice) * 100) : 0;

  return {
    id: product.id,
    sku: product.sku,
    name: product.name,
    regularPrice: product.regularPrice / 100,
    promoPrice: product.promoPrice / 100,
    discountPercent: discountPercent > 0 ? discountPercent : null,
    stock: product.stock,
    isPinned: product.isPinned,
  };
}

/**
 * Теги панели со статусами. Отмеченный в адресе тег показываем и до ответа ручки тегов —
 * именем, без счётчика: иначе после перехода по ссылке отметка пропала бы до загрузки списка.
 */
export function toTagsWithStatus(
  tags: readonly ITag[],
  selectedNames: readonly string[],
  excludedNames: readonly string[],
): ITagWithStatus[] {
  const selected = new Set(selectedNames);
  const excluded = new Set(excludedNames);
  const known = new Map(tags.map((tag) => [tag.name, tag]));

  for (const name of [...selected, ...excluded]) {
    if (!known.has(name)) {
      known.set(name, { id: name, name });
    }
  }

  return [...known.values()].map((tag) => {
    const status = toTagStatus(tag.name, selected, excluded);

    return { ...tag, status, statusLabel: TAG_STATUS_LABELS[status] };
  });
}

function toTagStatus(name: string, selected: ReadonlySet<string>, excluded: ReadonlySet<string>): ETagStatus {
  if (selected.has(name)) {
    return ETagStatus.INCLUDED;
  }

  return excluded.has(name) ? ETagStatus.EXCLUDED : ETagStatus.DEFAULT;
}

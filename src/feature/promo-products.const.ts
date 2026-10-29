import type { ISortOption } from './promo-products.interface';

import { ESortOption, ETagStatus } from '../promo-products.enum';

/** Строк на странице таблицы: выдача режется на бэкенде, клиент больше одной страницы не держит. */
export const PAGE_SIZE = 50;
export const SEARCH_DEBOUNCE_MS = 300;
export const SKELETON_ROWS_COUNT = 8;

/** Порядок, в котором клик по тегу переводит его между состояниями. */
export const NEXT_TAG_STATUS: Readonly<Record<ETagStatus, ETagStatus>> = {
  [ETagStatus.DEFAULT]: ETagStatus.INCLUDED,
  [ETagStatus.INCLUDED]: ETagStatus.EXCLUDED,
  [ETagStatus.EXCLUDED]: ETagStatus.DEFAULT,
};

/** Состояние тега словами: цвет и зачёркивание скринридер не передаёт. */
export const TAG_STATUS_LABELS: Readonly<Record<ETagStatus, string>> = {
  [ETagStatus.DEFAULT]: 'не учитывается',
  [ETagStatus.INCLUDED]: 'выбран',
  [ETagStatus.EXCLUDED]: 'исключён',
};

export const SORT_OPTIONS: readonly ISortOption[] = [
  { value: ESortOption.RECOMMENDED, label: 'Рекомендуемые' },
  { value: ESortOption.BEST_SELLING, label: 'Хиты продаж' },
  { value: ESortOption.BIGGEST_DISCOUNT, label: 'Наибольшая скидка' },
  { value: ESortOption.PRICE_ASC, label: 'Сначала дешевле' },
  { value: ESortOption.PRICE_DESC, label: 'Сначала дороже' },
  { value: ESortOption.NEWEST, label: 'Новинки' },
];

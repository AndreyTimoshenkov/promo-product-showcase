import type { ESortOption, ETagStatus } from '../promo-products.enum';
import type { ITag } from '../promo-products.interface';

export interface ISortOption {
  readonly value: ESortOption;
  readonly label: string;
}

/** Строка таблицы: цены в рублях, форматирует их шаблон. */
export interface IPromoProductRow {
  readonly id: string;
  readonly sku: string;
  readonly name: string;
  readonly regularPrice: number;
  readonly promoPrice: number;
  /** `null`, когда цена по акции не ниже обычной: такой скидки на ценнике не показываем. */
  readonly discountPercent: number | null;
  readonly stock: number;
  readonly isPinned: boolean;
}

export interface ITagWithStatus extends ITag {
  readonly status: ETagStatus;
  readonly statusLabel: string;
}

/** Правка той части состояния экрана, что живёт в адресе: поле, которого нет, адрес не трогает. */
export interface IUrlStatePatch {
  readonly page?: number;
  readonly tags?: readonly string[];
  readonly excludeTags?: readonly string[];
}

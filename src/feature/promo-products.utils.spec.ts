import { convertToParamMap } from '@angular/router';

import { isSameList, toPage, toRequestPage, toRow, toTagsWithStatus } from './promo-products.utils';

import { ETagStatus } from '../promo-products.enum';
import type { IPromoProduct } from '../promo-products.interface';

const PRODUCT: IPromoProduct = {
  id: 'p-1',
  sku: '100500',
  name: 'Молоко 3,2%',
  regularPrice: 11_990,
  promoPrice: 8_990,
  stock: 0,
  isPinned: true,
};

describe('promo-products.utils', () => {
  describe('isSameList', () => {
    it.each([
      [[], [], true],
      [['Выпечка', 'Детское'], ['Выпечка', 'Детское'], true],
      [['Выпечка', 'Детское'], ['Детское', 'Выпечка'], false],
      [['Выпечка'], ['Выпечка', 'Детское'], false],
    ])('compares %j with %j as %s', (left, right, isSame) => {
      expect(isSameList(left, right)).toBe(isSame);
    });
  });

  describe('toPage', () => {
    it.each([
      [{ page: '3' }, 3],
      [{}, 1],
      [{ page: '0' }, 1],
      [{ page: '-2' }, 1],
      [{ page: '2.5' }, 1],
      [{ page: 'abc' }, 1],
    ])('reads %j as page %i', (params, page) => {
      expect(toPage(convertToParamMap(params))).toBe(page);
    });
  });

  describe('toRequestPage', () => {
    it('trusts the URL page while the total is unknown', () => {
      expect(toRequestPage(5, null, 50)).toBe(5);
    });

    it('clamps to the last page once the total is known', () => {
      expect(toRequestPage(12, 120, 50)).toBe(3);
    });

    it('keeps the first page for an empty result', () => {
      expect(toRequestPage(4, 0, 50)).toBe(1);
    });
  });

  describe('toRow', () => {
    it('converts kopecks to rubles and rounds the discount', () => {
      expect(toRow(PRODUCT)).toEqual({
        id: 'p-1',
        sku: '100500',
        name: 'Молоко 3,2%',
        regularPrice: 119.9,
        promoPrice: 89.9,
        discountPercent: 25,
        stock: 0,
        isPinned: true,
      });
    });

    it.each([
      ['without a regular price', { regularPrice: 0, promoPrice: 0 }],
      ['when the promo price equals the regular one', { regularPrice: 10_000, promoPrice: 10_000 }],
      ['when the promo price is higher', { regularPrice: 10_000, promoPrice: 10_500 }],
    ])('shows no discount %s', (_, prices) => {
      expect(toRow({ ...PRODUCT, ...prices }).discountPercent).toBeNull();
    });
  });

  describe('toTagsWithStatus', () => {
    const TAGS = [
      { id: 't-1', name: 'Молочные продукты', count: 12 },
      { id: 't-2', name: 'Детское', count: 4 },
      { id: 't-3', name: 'Выпечка', count: 7 },
    ];

    it('marks tags from the URL as included or excluded', () => {
      const statuses = toTagsWithStatus(TAGS, ['Молочные продукты'], ['Детское']).map(({ name, status, statusLabel }) => [
        name,
        status,
        statusLabel,
      ]);

      expect(statuses).toEqual([
        ['Молочные продукты', ETagStatus.INCLUDED, 'выбран'],
        ['Детское', ETagStatus.EXCLUDED, 'исключён'],
        ['Выпечка', ETagStatus.DEFAULT, 'не учитывается'],
      ]);
    });

    it('keeps a tag from the URL before the tags list arrives', () => {
      expect(toTagsWithStatus([], ['Молочные продукты'], [])).toEqual([
        { id: 'Молочные продукты', name: 'Молочные продукты', status: ETagStatus.INCLUDED, statusLabel: 'выбран' },
      ]);
    });
  });
});

import { toHttpParams, toProductsPage, toProductTags } from './promo-products-backend.utils';

import { ESortOption } from '../promo-products.enum';
import type { IPromoProductDto } from '../promo-products.interface';

const DTO: IPromoProductDto = { id: 'p-1', sku: '100500', title: 'Молоко 3,2%', regular_price: 11_990, promo_price: 8_990, stock_qty: 12 };

describe('promo-products-backend.utils', () => {
  describe('toHttpParams', () => {
    it('sends every filter that is set', () => {
      const params = toHttpParams({
        page: 2,
        limit: 50,
        search: '  молоко ',
        tags: ['Молочные продукты', 'Выпечка'],
        excludeTags: ['Детское'],
        inStockOnly: false,
        sortBy: ESortOption.PRICE_ASC,
      });

      expect({
        page: params.get('page'),
        limit: params.get('limit'),
        search: params.get('search'),
        tags: params.getAll('tags'),
        excludeTags: params.getAll('excludeTags'),
        inStockOnly: params.get('inStockOnly'),
        sortBy: params.get('sortBy'),
      }).toEqual({
        page: '2',
        limit: '50',
        search: 'молоко',
        tags: ['Молочные продукты', 'Выпечка'],
        excludeTags: ['Детское'],
        inStockOnly: 'false',
        sortBy: 'price_asc',
      });
    });

    it('leaves out empty and missing filters', () => {
      const params = toHttpParams({ page: 0, limit: 0, search: '   ', tags: [''], excludeTags: [] });

      expect(params.keys()).toEqual([]);
    });

    it('keeps a tag that contains a comma as one value', () => {
      expect(toHttpParams({ tags: ['Свежее, охлаждённое'] }).getAll('tags')).toEqual(['Свежее, охлаждённое']);
    });
  });

  describe('toProductsPage', () => {
    it('maps the DTO to the product model', () => {
      expect(toProductsPage({ items: [{ ...DTO, is_pinned: true }], totalCount: 1 })).toEqual({
        items: [{ id: 'p-1', sku: '100500', name: 'Молоко 3,2%', regularPrice: 11_990, promoPrice: 8_990, stock: 12, isPinned: true }],
        totalCount: 1,
      });
    });

    it.each([
      ['totalCount', { items: [DTO], totalCount: 120, pagination: { total: 99 } }, 120],
      ['pagination.total', { items: [DTO], pagination: { total: 51 } }, 51],
      ['the page length', { items: [DTO] }, 1],
    ])('takes the total from %s', (_, response, totalCount) => {
      expect(toProductsPage(response).totalCount).toBe(totalCount);
    });

    it('treats a missing list as an empty page', () => {
      expect(toProductsPage({})).toEqual({ items: [], totalCount: 0 });
    });
  });

  describe('toProductTags', () => {
    const TAGS = [{ id: 't-1', name: 'Выпечка', count: 3 }];

    it.each([
      ['an array', TAGS, TAGS],
      ['a { tags } wrapper', { tags: TAGS }, TAGS],
      ['an empty wrapper', {}, []],
      ['null', null, []],
    ])('reads %s', (_, response, tags) => {
      expect(toProductTags(response)).toEqual(tags);
    });
  });
});

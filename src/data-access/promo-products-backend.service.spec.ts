import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { firstValueFrom } from 'rxjs';

import { PromoProductsBackendService } from './promo-products-backend.service';

describe('PromoProductsBackendService', () => {
  let service: PromoProductsBackendService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(PromoProductsBackendService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('requests the campaign products with the query filters and maps the page', async () => {
    const page = firstValueFrom(service.getProducts({ campaignId: 'summer sale', page: 2, search: 'молоко' }));

    const request = http.expectOne((req) => req.url === '/promo-campaigns/summer%20sale/products');
    expect({ page: request.request.params.get('page'), search: request.request.params.get('search') }).toEqual({
      page: '2',
      search: 'молоко',
    });

    request.flush({
      items: [{ id: 'p-1', sku: '100500', title: 'Молоко', regular_price: 100, promo_price: 90, stock_qty: 1 }],
      totalCount: 1,
    });

    expect(await page).toEqual({
      items: [{ id: 'p-1', sku: '100500', name: 'Молоко', regularPrice: 100, promoPrice: 90, stock: 1, isPinned: false }],
      totalCount: 1,
    });
  });

  it('requests the campaign tags with the slice filters', async () => {
    const tags = [{ id: 't-1', name: 'Выпечка', count: 3 }];
    const result = firstValueFrom(service.getProductTags({ campaignId: 'promo-1', tags: ['Выпечка'], inStockOnly: true }));

    const request = http.expectOne((req) => req.url === '/promo-campaigns/promo-1/products/tags');
    expect({ tags: request.request.params.getAll('tags'), inStockOnly: request.request.params.get('inStockOnly') }).toEqual({
      tags: ['Выпечка'],
      inStockOnly: 'true',
    });

    request.flush({ tags });

    expect(await result).toEqual(tags);
  });
});

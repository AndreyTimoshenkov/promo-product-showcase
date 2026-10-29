import { registerLocaleData } from '@angular/common';
import localeRu from '@angular/common/locales/ru';
import { fakeAsync, TestBed, tick } from '@angular/core/testing';
import { provideRouter, Router, withComponentInputBinding } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';

import { of, Subject, throwError } from 'rxjs';

import { PromoProductsComponent } from './promo-products.component';
import { SEARCH_DEBOUNCE_MS, SKELETON_ROWS_COUNT } from './promo-products.const';

import { PromoProductsBackendService } from '../data-access/promo-products-backend.service';
import type { IPromoProduct, IPromoProductsPage } from '../promo-products.interface';

registerLocaleData(localeRu);

const PRODUCT: IPromoProduct = {
  id: 'p-1',
  sku: '100500',
  name: 'Молоко',
  regularPrice: 10_000,
  promoPrice: 7_500,
  stock: 3,
  isPinned: false,
};

function page(totalCount: number): IPromoProductsPage {
  return { items: [PRODUCT], totalCount };
}

describe('PromoProductsComponent', () => {
  let getProducts: jest.Mock;
  let getProductTags: jest.Mock;
  let harness: RouterTestingHarness;

  beforeEach(() => {
    getProducts = jest.fn(() => of(page(500)));
    getProductTags = jest.fn(() => of([]));
    TestBed.configureTestingModule({
      providers: [
        provideRouter([{ path: 'promo-campaigns/:campaignId/products', component: PromoProductsComponent }], withComponentInputBinding()),
        { provide: PromoProductsBackendService, useValue: { getProducts, getProductTags } },
      ],
    });
  });

  /** Навигация, отрисовка и эффекты: после неё и запросы, и адрес приходят в покой. */
  function settle(): void {
    tick();
    harness.detectChanges();
    tick();
    harness.detectChanges();
  }

  function open(url: string): void {
    void RouterTestingHarness.create(url).then((created) => (harness = created));
    tick();
    settle();
  }

  function requestedPages(): Array<number | undefined> {
    return getProducts.mock.calls.map(([query]) => query.page);
  }

  function urlTagState(): { tags: string[]; excludeTags: string[]; page: string | null } {
    const params = TestBed.inject(Router).parseUrl(currentUrl()).queryParamMap;

    return { tags: params.getAll('tags'), excludeTags: params.getAll('excludeTags'), page: params.get('page') };
  }

  function clickButton(selector: string, text?: string): void {
    const buttons = [...harness.routeNativeElement!.querySelectorAll<HTMLButtonElement>(selector)];
    buttons.find((button) => text === undefined || button.textContent?.trim() === text)!.click();
    settle();
  }

  function currentUrl(): string {
    return TestBed.inject(Router).url;
  }

  it('requests the page from a shared link right away', fakeAsync(() => {
    open('/promo-campaigns/promo-1/products?page=3');

    expect(requestedPages()).toEqual([3]);
  }));

  it('falls back to the last page when the link points past the result', fakeAsync(() => {
    getProducts.mockReturnValue(of(page(120)));

    open('/promo-campaigns/promo-1/products?page=12');

    expect(requestedPages()).toEqual([12, 3]);
    expect(currentUrl()).toBe('/promo-campaigns/promo-1/products?page=3');
  }));

  it('does not clamp a broader result by the total of a narrower one', fakeAsync(() => {
    getProducts.mockReturnValue(of(page(30)));
    open('/promo-campaigns/promo-1/products?tags=Выпечка');

    getProducts.mockReturnValue(of(page(500)));
    void harness.navigateByUrl('/promo-campaigns/promo-1/products?page=3');
    settle();

    expect(requestedPages()).toEqual([1, 3]);
    expect(currentUrl()).toBe('/promo-campaigns/promo-1/products?page=3');
  }));

  it('requests the first page once when a filter changes on a later page', fakeAsync(() => {
    open('/promo-campaigns/promo-1/products?page=3');

    const search = harness.routeNativeElement!.querySelector<HTMLInputElement>('input[type="search"]')!;
    search.value = 'молоко';
    search.dispatchEvent(new Event('input'));
    tick(SEARCH_DEBOUNCE_MS);
    settle();

    expect(requestedPages()).toEqual([3, 1]);
    expect(getProducts.mock.calls[1][0]).toMatchObject({ search: 'молоко', page: 1 });
    expect(currentUrl()).toBe('/promo-campaigns/promo-1/products');
  }));

  it('shows the initial skeleton again after switching to another campaign', fakeAsync(() => {
    open('/promo-campaigns/promo-1/products');

    getProducts.mockReturnValue(new Subject<IPromoProductsPage>());
    void harness.navigateByUrl('/promo-campaigns/promo-2/products');
    settle();

    expect(harness.routeNativeElement!.querySelectorAll('tbody tr[aria-hidden="true"]')).toHaveLength(SKELETON_ROWS_COUNT);
  }));

  it('cycles a tag through selected, excluded and none, back on the first page', fakeAsync(() => {
    getProductTags.mockReturnValue(of([{ id: 't-1', name: 'Выпечка', count: 7 }]));
    open('/promo-campaigns/promo-1/products?page=3');

    clickButton('button.tag');
    expect(urlTagState()).toEqual({ tags: ['Выпечка'], excludeTags: [], page: null });

    clickButton('button.tag');
    expect(urlTagState()).toEqual({ tags: [], excludeTags: ['Выпечка'], page: null });

    clickButton('button.tag');
    expect(urlTagState()).toEqual({ tags: [], excludeTags: [], page: null });
  }));

  it('clears selected and excluded tags with the reset button', fakeAsync(() => {
    open('/promo-campaigns/promo-1/products?tags=Выпечка&excludeTags=Детское&page=2');

    clickButton('button', 'Сбросить теги');

    expect(urlTagState()).toEqual({ tags: [], excludeTags: [], page: null });
  }));

  it('names the state of each tag for screen readers', fakeAsync(() => {
    getProductTags.mockReturnValue(of([{ id: 't-1', name: 'Выпечка', count: 7 }]));
    open('/promo-campaigns/promo-1/products?excludeTags=Выпечка');

    const tag = harness.routeNativeElement!.querySelector<HTMLButtonElement>('button.tag')!;
    const hint = harness.routeNativeElement!.querySelector(`#${tag.getAttribute('aria-describedby')}`);

    expect(tag.textContent?.replace(/\s+/g, ' ').trim()).toBe('Выпечка 7, исключён');
    expect(tag.hasAttribute('aria-pressed')).toBe(false);
    expect(hint?.textContent).toContain('выбран → исключён → не учитывается');
  }));

  it('retries the failed products request from the error state', fakeAsync(() => {
    getProducts.mockReturnValueOnce(throwError(() => new Error('Request failed')));
    open('/promo-campaigns/promo-1/products');

    const retry = [...harness.routeNativeElement!.querySelectorAll('button')].find((button) => button.textContent?.trim() === 'Повторить');
    retry!.click();
    settle();

    expect(getProducts).toHaveBeenCalledTimes(2);
    expect(harness.routeNativeElement!.querySelector('[role="alert"]')).toBeNull();
  }));
});

import { CurrencyPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, effect, ElementRef, inject, input, linkedSignal, untracked } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';

import { debounceTime, map } from 'rxjs';

import { NEXT_TAG_STATUS, PAGE_SIZE, SEARCH_DEBOUNCE_MS, SKELETON_ROWS_COUNT, SORT_OPTIONS } from './promo-products.const';
import type { IPromoProductRow, ISortOption, ITagWithStatus, IUrlStatePatch } from './promo-products.interface';
import { isSameList, toPage, toRequestPage, toRow, toTagsWithStatus } from './promo-products.utils';

import { PromoProductsStore } from '../data-access/promo-products.store';
import { ESortOption, ETagStatus } from '../promo-products.enum';
import type { IPromoProductsQuery, IPromoProductsSlice } from '../promo-products.interface';

// Счётчик на сервере и в браузере расходится, и при гидратации Angular перезаписывает `[id]` клиентским.
// Принимаем это: id нужен только для связки aria-describedby внутри инстанса, и связка не рвётся.
let nextInstanceId = 0;

@Component({
  selector: 'app-promo-products',
  styleUrl: './promo-products.component.scss',
  templateUrl: './promo-products.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  // Своя выдача со своими поиском, сортировкой и страницей — поэтому и свой инстанс стора.
  providers: [PromoProductsStore],
  imports: [ReactiveFormsModule, CurrencyPipe],
})
export class PromoProductsComponent {
  readonly #router = inject(Router);
  readonly #route = inject(ActivatedRoute);
  readonly #hostRef = inject<ElementRef<HTMLElement>>(ElementRef);
  protected readonly store = inject(PromoProductsStore);

  /** Приходит параметром маршрута через `withComponentInputBinding`. */
  readonly campaignId = input<string>('');

  protected readonly sortOptions: readonly ISortOption[] = SORT_OPTIONS;
  protected readonly ETagStatus = ETagStatus;
  /** Подсказка на экране может быть не одна, поэтому id уникален для инстанса. */
  protected readonly tagsHintId = `promo-products-tags-hint-${nextInstanceId++}`;
  protected readonly skeletonRows: readonly number[] = Array.from({ length: SKELETON_ROWS_COUNT }, (_, index) => index);

  /**
   * Поиск, сортировка и остатки — локальные фильтры таблицы: в адрес они не попадают.
   * Страница и теги живут в адресе, чтобы ссылкой на выдачу можно было поделиться.
   */
  protected readonly filtersForm = inject(NonNullableFormBuilder).group({
    search: '',
    sortBy: ESortOption.RECOMMENDED,
    inStockOnly: true,
  });

  // Повторы отсеивать не нужно: сигнал не меняется, если пришло то же значение, — «молоко » после «молоко» запроса не даст.
  readonly #search = toSignal(
    this.filtersForm.controls.search.valueChanges.pipe(
      map((search) => search.trim()),
      debounceTime(SEARCH_DEBOUNCE_MS),
    ),
    { initialValue: '' },
  );

  readonly #sortBy = toSignal(this.filtersForm.controls.sortBy.valueChanges, { initialValue: this.filtersForm.controls.sortBy.value });

  readonly #inStockOnly = toSignal(this.filtersForm.controls.inStockOnly.valueChanges, {
    initialValue: this.filtersForm.controls.inStockOnly.value,
  });

  readonly #queryParams = toSignal(this.#route.queryParamMap, { requireSync: true });
  // `getAll` отдаёт новый массив на любую смену адреса; без сравнения по значению смена страницы
  // пересобирала бы срез, список тегов и запрос тегов.
  readonly #selectedTagNames = computed<readonly string[]>(() => this.#queryParams().getAll('tags'), { equal: isSameList });
  readonly #excludedTagNames = computed<readonly string[]>(() => this.#queryParams().getAll('excludeTags'), { equal: isSameList });
  readonly #requestedPage = computed<number>(() => toPage(this.#queryParams()));

  readonly #localFiltersKey = computed<string>(() => JSON.stringify([this.#search(), this.#sortBy(), this.#inStockOnly()]));

  /**
   * Локальные фильтры, при которых в адресе появилась текущая страница. Сменились фильтры — страница
   * из адреса уже о другой выдаче, и запрос сразу уходит за первой, не дожидаясь правки адреса.
   */
  readonly #pageFiltersKey = linkedSignal<number, string>({
    source: this.#requestedPage,
    computation: () => untracked(this.#localFiltersKey),
  });

  readonly #pageForFilters = computed<number>(() => (this.#pageFiltersKey() === this.#localFiltersKey() ? this.#requestedPage() : 1));

  /**
   * Срез выдачи: по нему считаются теги и размер выдачи. Страница и сортировка в него не входят:
   * они режут и переставляют тот же срез.
   */
  readonly #slice = computed<IPromoProductsSlice>(() => ({
    campaignId: this.campaignId(),
    search: this.#search(),
    tags: this.#selectedTagNames(),
    excludeTags: this.#excludedTagNames(),
    inStockOnly: this.#inStockOnly(),
  }));

  /** Размер другого среза — другой акции или других тегов — о текущем ничего не говорит, поэтому до ответа он неизвестен. */
  readonly #knownTotalCount = computed<number | null>(() => this.store.knownTotalCountFor(this.#slice()));

  protected readonly currentPage = computed<number>(() => toRequestPage(this.#pageForFilters(), this.#knownTotalCount(), PAGE_SIZE));
  protected readonly totalPages = computed<number>(() => Math.max(1, Math.ceil(this.store.totalCount() / PAGE_SIZE)));

  readonly #productsQuery = computed<IPromoProductsQuery>(() => ({
    ...this.#slice(),
    page: this.currentPage(),
    limit: PAGE_SIZE,
    sortBy: this.#sortBy(),
  }));

  protected readonly rows = computed<readonly IPromoProductRow[]>(() => this.store.products().map(toRow));

  protected readonly tags = computed<readonly ITagWithStatus[]>(() =>
    toTagsWithStatus(this.store.tags(), this.#selectedTagNames(), this.#excludedTagNames()),
  );

  protected readonly hasActiveTags = computed<boolean>(() => !!(this.#selectedTagNames().length || this.#excludedTagNames().length));

  /** Скелетон панель рисует только под первый список: мигание на каждый клик по тегу заметнее смены счётчиков. */
  protected readonly isTagsSkeleton = computed<boolean>(() => this.store.tagsLoading() && !this.store.hasCompletedTagsRequest());

  /** Первая загрузка: строк ещё нет, поэтому под шапкой таблицы — строки-заглушки. */
  protected readonly isInitialLoading = computed<boolean>(() => this.store.loading() && !this.store.hasCompletedRequest());
  protected readonly isEmpty = computed<boolean>(() => !this.store.loading() && !this.store.error() && !this.rows().length);

  constructor() {
    this.#syncPageToUrlEffect();
    this.#loadProductsEffect();
    this.#loadTagsEffect();
  }

  protected changePage(page: number): void {
    if (page < 1 || page > this.totalPages() || page === this.currentPage()) {
      return;
    }

    this.#navigate({ page });
    // Новая страница рисуется на месте старой: без подъёма пользователь остаётся в середине таблицы.
    queueMicrotask(() => this.#hostRef.nativeElement.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  }

  /** Клик по тегу: имя переезжает между «выбранными», «исключёнными» и ничем. */
  protected toggleTag(tag: ITagWithStatus): void {
    const status = NEXT_TAG_STATUS[tag.status];
    const tags = this.#selectedTagNames().filter((name) => name !== tag.name);
    const excludeTags = this.#excludedTagNames().filter((name) => name !== tag.name);

    if (status === ETagStatus.INCLUDED) {
      tags.push(tag.name);
    }

    if (status === ETagStatus.EXCLUDED) {
      excludeTags.push(tag.name);
    }

    this.#navigate({ tags, excludeTags, page: 1 });
  }

  protected resetTags(): void {
    this.#navigate({ tags: [], excludeTags: [], page: 1 });
  }

  /** После ошибки стор пропускает тот же запрос повторно, поэтому повтор — это просто ещё один `load`. */
  protected retryProducts(): void {
    this.store.load(this.#productsQuery());
  }

  protected retryTags(): void {
    this.store.reloadTags(this.#slice());
  }

  /** Пустой массив и первая страница из адреса убираются: ссылка без фильтров остаётся чистой. */
  #navigate({ page, tags, excludeTags }: IUrlStatePatch, replaceUrl = false): void {
    void this.#router.navigate([], {
      relativeTo: this.#route,
      queryParamsHandling: 'merge',
      replaceUrl,
      queryParams: {
        ...(page === undefined ? {} : { page: page > 1 ? page : null }),
        ...(tags === undefined ? {} : { tags: tags.length ? tags : null }),
        ...(excludeTags === undefined ? {} : { excludeTags: excludeTags.length ? excludeTags : null }),
      },
    });
  }

  /**
   * Запрошенная страница могла смениться без адреса: сброс на первую после смены фильтров или
   * ограничение по размеру выдачи. Адрес догоняет её с `replaceUrl`, чтобы «Назад» не вёл на пустую страницу.
   */
  #syncPageToUrlEffect(): void {
    effect(() => {
      const currentPage = this.currentPage();

      if (currentPage === this.#requestedPage()) {
        return;
      }

      untracked(() => this.#navigate({ page: currentPage }, true));
    });
  }

  /** Каждая смена фильтров или страницы — новый запрос; повтор того же запроса стор отсеет сам. */
  #loadProductsEffect(): void {
    effect(() => {
      const query = this.#productsQuery();

      if (!query.campaignId) {
        return;
      }

      untracked(() => this.store.load(query));
    });
  }

  #loadTagsEffect(): void {
    effect(() => {
      const query = this.#slice();

      if (!query.campaignId) {
        return;
      }

      untracked(() => this.store.loadTags(query));
    });
  }
}

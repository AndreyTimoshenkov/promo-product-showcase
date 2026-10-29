import type { Routes } from '@angular/router';

/**
 * Раздел подключается лениво: `loadComponent` выносит компонент, стор и транспорт в отдельный чанк,
 * и стартовый бандл приложения их не тянет. `campaignId` доезжает до input компонента через
 * `withComponentInputBinding()` в `provideRouter`.
 */
export const PROMO_PRODUCTS_ROUTES: Routes = [
  {
    path: 'promo-campaigns/:campaignId/products',
    loadComponent: () => import('./promo-products.component').then((m) => m.PromoProductsComponent),
  },
];

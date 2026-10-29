import { registerLocaleData } from '@angular/common';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import localeRu from '@angular/common/locales/ru';
import { provideZonelessChangeDetection } from '@angular/core';
import { bootstrapApplication } from '@angular/platform-browser';
import { provideRouter, withComponentInputBinding } from '@angular/router';

import { DemoRootComponent } from './demo-root.component';
import { mockBackendInterceptor } from './mock-backend.interceptor';

import { PROMO_PRODUCTS_ROUTES } from '../src/feature/promo-products.routes';

registerLocaleData(localeRu);

// Хост собран ровно из того, что README перечисляет как требования к приложению: HTTP, роутер
// с привязкой параметров к input, локаль. Zoneless — фича держится только на сигналах.
// Ошибку старта отдельно не ловим: необработанный reject и так попадёт в консоль браузера.
void bootstrapApplication(DemoRootComponent, {
  providers: [
    provideZonelessChangeDetection(),
    provideHttpClient(withInterceptors([mockBackendInterceptor])),
    provideRouter(
      [{ path: '', pathMatch: 'full', redirectTo: 'promo-campaigns/summer-sale/products' }, ...PROMO_PRODUCTS_ROUTES],
      withComponentInputBinding(),
    ),
  ],
});

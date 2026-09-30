import { ApplicationConfig, inject, provideAppInitializer, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter } from '@angular/router';
import { routes } from './app.routes';
import { provideClientHydration } from '@angular/platform-browser';
import { ProductService } from './services/product.service';
import { ContentService } from './services/content.service';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    provideClientHydration(),
    provideAppInitializer(async () => {
      const content = inject(ContentService);
      await Promise.all([inject(ProductService).ready(), content.ready()]);
    }),
  ],
};

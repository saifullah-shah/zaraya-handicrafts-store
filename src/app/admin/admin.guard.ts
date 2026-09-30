import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AdminAuthService } from './services/admin-auth.service';

export const adminGuard: CanActivateFn = async () => {
  const auth = inject(AdminAuthService);
  const router = inject(Router);

  if (auth.ready()) {
    if (auth.isAdmin()) return true;
    return router.createUrlTree(['/admin/login']);
  }

  if (typeof window === 'undefined') {
    return router.createUrlTree(['/admin/login']);
  }

  await auth.init();
  if (auth.isAdmin()) return true;
  return router.createUrlTree(['/admin/login']);
};
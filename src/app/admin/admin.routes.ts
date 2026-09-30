import { Routes } from '@angular/router';
import { adminGuard } from './admin.guard';
import { AdminLayoutComponent } from './components/admin-layout.component';
import { AdminLoginPage } from './pages/admin-login.page';
import { AdminDashboardPage } from './pages/admin-dashboard.page';
import { AdminProductsPage } from './pages/products/admin-products.page';
import { AdminProductEditPage } from './pages/products/admin-product-edit.page';
import { AdminOrdersPage } from './pages/orders/admin-orders.page';
import { AdminOrderDetailPage } from './pages/orders/admin-order-detail.page';
import { AdminContentPage } from './pages/admin-content.page';
import { AdminSettingsPage } from './pages/admin-settings.page';

export const adminRoutes: Routes = [
  { path: 'login', component: AdminLoginPage },
  {
    path: '',
    component: AdminLayoutComponent,
    canActivate: [adminGuard],
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
      { path: 'dashboard', component: AdminDashboardPage },
      { path: 'products', component: AdminProductsPage },
      { path: 'products/new', component: AdminProductEditPage },
      { path: 'products/:id', component: AdminProductEditPage },
      { path: 'orders', component: AdminOrdersPage },
      { path: 'orders/:id', component: AdminOrderDetailPage },
      { path: 'content', component: AdminContentPage },
      { path: 'settings', component: AdminSettingsPage },
    ],
  },
];
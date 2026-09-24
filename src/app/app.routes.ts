import { Routes } from '@angular/router';
import { HomePage } from './pages/home.page';
import { ProductPage } from './pages/product.page';
import { AboutPage } from './pages/about.page';
import { ContactPage } from './pages/contact.page';
import { CartPage } from './pages/cart.page';
import { LoginPage } from './pages/login.page';
import { CheckoutPage } from './pages/checkout.page';
import { OrderConfirmationPage } from './pages/order-confirmation.page';

export const routes: Routes = [
  { path: '', component: HomePage },
  { path: 'about', component: AboutPage },
  { path: 'contact', component: ContactPage },
  { path: 'login', component: LoginPage },
  { path: 'cart', component: CartPage },
  { path: 'checkout', component: CheckoutPage },
  { path: 'order-confirmation', component: OrderConfirmationPage },
  { path: 'product/:slug', component: ProductPage },
  { path: '**', redirectTo: '' },
];

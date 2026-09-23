export interface Product {
  id: string;
  slug: string;
  name: string;
  price: number;
  compareAtPrice?: number;
  rating: number;
  reviews: number;
  badge: string;
  category: string;
  materials: string[];
  description: string;
  longDescription: string;
  images: string[];
  colors: string[];
  sizes: string[];
  stock: number;
  giftPackaging: boolean;
  details: string[];
}

export interface CartItem {
  productId: string;
  quantity: number;
  color: string;
  size: string;
  giftPackaging: boolean;
}

export interface Address {
  fullName: string;
  email: string;
  phone: string;
  street: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
}

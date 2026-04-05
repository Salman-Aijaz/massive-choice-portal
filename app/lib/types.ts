// lib/types.ts
export enum ProductCategory {
  MEN = 'MEN',
  WOMEN = 'WOMEN',
  KIDS = 'KIDS',
  COUPLE = 'COUPLE',
  SMART_WATCHES = 'SMART_WATCHES',
  CLASSIC = 'CLASSIC',
  SPORT = 'SPORT',
  LUXURY = 'LUXURY',
}

export const CATEGORY_OPTIONS = Object.values(ProductCategory).map((cat) => ({
  value: cat,
  label: cat.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (l) => l.toUpperCase()),
}));

// ✅ Product type update - specifications remove, categories array
export type Product = {
  id: number;
  title: string;
  original_price: number;
  discount_price: number | null;
  description: string;
  images: string[] | string;
  quantity: number;
  categories: ProductCategory[]; // ✅ Array ab
  created_at?: string;
  updated_at?: string;
};
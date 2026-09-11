import type { Product } from '../../src/product/schema';

/** Build a Product fixture; prices in the epic ACs are expressed in VND. */
export function product(
  productId: string,
  price: number,
  overrides: Partial<Product> = {},
): Product {
  return {
    productId,
    name: `Sản phẩm ${productId}`,
    image: `assets/${productId}.webp`,
    price,
    currency: 'VND',
    source: 'mock',
    updatedAt: '2026-09-11T00:00:00Z',
    category: 'gia dụng',
    brand: 'Mock',
    affiliate_link: `https://shopee.vn/${productId}?aff=123`,
    ...overrides,
  };
}

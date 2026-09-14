import type { Product } from '../../product/schema';

export class EligibilityFilter {
  constructor(private readonly requiredFields: Array<keyof Product>) {}

  apply(products: Product[]): Product[] {
    return products.filter((product) => {
      for (const field of this.requiredFields) {
        const val = product[field];
        if (val === undefined || val === null || val === '') {
          return false;
        }
      }
      return typeof product.price === 'number' && product.price > 0;
    });
  }
}

// AD-5: ProductProvider — 50 files products/pXXX.json, atomic, cache
const fs = require('fs');
const path = require('path');

class ProductProvider {
  constructor(productsDir) {
    this.productsDir = productsDir;
    this.cache = new Map();
    this.loadAll();
  }
  loadAll() {
    this.cache.clear();
    if (!fs.existsSync(this.productsDir)) return;
    const files = fs.readdirSync(this.productsDir).filter(f => f.endsWith('.json'));
    for (const f of files) {
      try {
        const data = JSON.parse(fs.readFileSync(path.join(this.productsDir, f), 'utf-8'));
        // minimal zod-like check
        if (!data.productId || !data.price) throw new Error('missing field');
        this.cache.set(data.productId, data);
      } catch (e) {
        console.warn(`[ProductProvider] failed to load ${f}: ${e.message}`);
      }
    }
  }
  get(productId) {
    return this.cache.get(productId) || null;
  }
  getAll() { return Array.from(this.cache.values()); }
  // Resolve entities: [{productId}] -> [{full product}]
  resolveEntities(entities) {
    return entities.map(e => {
      const p = this.get(e.productId);
      if (!p) throw new Error(`E_PRODUCT_NOT_FOUND:${e.productId}`);
      return { ...p };
    });
  }
}
module.exports = { ProductProvider };

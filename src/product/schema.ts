/**
 * Story 1.3 — Product schema (zod).
 *
 * Every `products/pXXX.json` must match this shape:
 * productId, name, image, price, currency, source, updatedAt, category, brand,
 * affiliate_link.
 */
import { z } from 'zod';

export const productSchema = z.object({
  productId: z
    .string()
    .min(1)
    .regex(/^p\d+$/, "productId must look like 'p001'"),
  name: z.string().min(1),
  image: z.string().min(1),
  price: z.number().int().positive(),
  currency: z.string().min(1),
  source: z.string().min(1),
  updatedAt: z.string().min(1),
  category: z.string().min(1),
  brand: z.string().min(1),
  affiliate_link: z.string().min(1),
});

export type Product = z.infer<typeof productSchema>;

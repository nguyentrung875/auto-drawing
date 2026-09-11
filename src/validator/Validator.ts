/**
 * Story 2.1 — Two-Layer Validator (Schema + Game Logic).
 *
 * AR-3: the Validator is a *separate filter*. It never mutates the Game JSON
 * and never calls the Engine — a failing result means the pipeline stops before
 * anything expensive (TTS / render) runs.
 *
 * Layer 1 (Schema): structure via the zod schema (`E_SCHEMA_MISSING_FIELD`),
 *   scenes ⊆ 7 MVP (`E_SCHEMA_SCENE_INVALID`), countdown+reveal present
 *   (`E_MISSING_REQUIRED_SCENE`).
 * Layer 2 (Game Logic): prices sourced from ProductProvider
 *   (`E_PRICE_SOURCE_INVALID`), asset existence (`E_ASSET_MISSING`), and the
 *   per-mechanic rules (`E_HILO_EQUAL_PRICE`, `E_MOST_EXPENSIVE_TIE`,
 *   `E_GAME_LOGIC_INVALID`).
 *
 * Warnings never block (AD-4): a missing affiliate_link yields
 * `W_AFFILIATE_MISSING` with `ok: true`.
 */
import { performance } from 'node:perf_hooks';
import { ZodError } from 'zod';
import { gameSchema, MVP_SCENES, REQUIRED_SCENES } from '../game/schema';
import type { Product } from '../product/schema';
import type { GameJson, Interaction, Mechanic } from '../types/game';

export interface ValidationIssue {
  code: string;
  field: string;
  hint: string;
}

export interface ValidationResult {
  ok: boolean;
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
  /** Wall-clock validation time in ms (must stay <200ms — FR-3). */
  durationMs: number;
}

/** Minimum HI_LO price delta (FR-6). */
export const HILO_MIN_DELTA = 0.05;
/** Minimum MOST_EXPENSIVE top-2 delta (FR-7). */
export const MOST_EXPENSIVE_MIN_DELTA = 0.02;

/**
 * Each mechanic's required viewer interaction (FR-6 BOOLEAN, FR-7
 * MULTIPLE_CHOICE, FR-8 DIGIT). A Game JSON whose `gameplay.interaction`
 * contradicts its `metadata.mechanic` would drive the Scene System to build
 * the wrong scene, so it is rejected here (same class of cross-check as the
 * metadata.mechanic ↔ gameplay.mechanic rule).
 */
const EXPECTED_INTERACTIONS: Record<Mechanic, Interaction> = {
  HI_LO: 'BOOLEAN',
  MOST_EXPENSIVE: 'MULTIPLE_CHOICE',
  ONE_AWAY: 'DIGIT',
};

export interface ValidateOptions {
  /**
   * Resolves whether a product's image asset exists on disk. Defaults to
   * "assume present" so the Validator stays pure/fast in unit tests.
   */
  assetExists?: (product: Product) => boolean;
}

function issue(code: string, field: string, hint: string): ValidationIssue {
  return { code, field, hint };
}

function pct(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

export class Validator {
  /** Layer 1 — structural / schema validation. */
  static validateSchema(game: unknown): ValidationIssue[] {
    const errors: ValidationIssue[] = [];
    const parsed = gameSchema.safeParse(game);
    if (!parsed.success) {
      for (const zi of (parsed.error as ZodError).issues) {
        errors.push(
          issue(
            'E_SCHEMA_MISSING_FIELD',
            zi.path.length > 0 ? zi.path.join('.') : 'game',
            zi.message === 'Required' ? 'required field is missing' : zi.message,
          ),
        );
      }
      return errors;
    }

    const scenes = parsed.data.scenes;
    const allowed = new Set<string>(MVP_SCENES);
    for (const scene of scenes) {
      if (!allowed.has(scene)) {
        errors.push(
          issue(
            'E_SCHEMA_SCENE_INVALID',
            `scenes.${scene}`,
            `scene '${scene}' is not one of the 7 MVP scenes (${MVP_SCENES.join(', ')})`,
          ),
        );
      }
    }
    for (const required of REQUIRED_SCENES) {
      if (!scenes.includes(required)) {
        errors.push(
          issue('E_MISSING_REQUIRED_SCENE', 'scenes', `${required} required`),
        );
      }
    }
    if (
      errors.length === 0 &&
      (scenes.length !== MVP_SCENES.length ||
        scenes.some((scene, index) => scene !== MVP_SCENES[index]))
    ) {
      errors.push(
        issue(
          'E_SCHEMA_SCENE_INVALID',
          'scenes',
          `scene order must be ${MVP_SCENES.join(' → ')}`,
        ),
      );
    }
    if (parsed.data.metadata.mechanic !== parsed.data.gameplay.mechanic) {
      errors.push(
        issue(
          'E_SCHEMA_MISSING_FIELD',
          'gameplay.mechanic',
          `must match metadata.mechanic ('${parsed.data.metadata.mechanic}')`,
        ),
      );
    }
    const expectedInteraction = EXPECTED_INTERACTIONS[parsed.data.metadata.mechanic];
    const interaction = parsed.data.gameplay.interaction;
    if (interaction !== undefined && interaction !== expectedInteraction) {
      errors.push(
        issue(
          'E_GAME_LOGIC_INVALID',
          'gameplay.interaction',
          `must match mechanic '${parsed.data.metadata.mechanic}' (expected '${expectedInteraction}')`,
        ),
      );
    }
    return errors;
  }

  /** Layer 2 — game logic validation against the resolved products. */
  static validateGameLogic(
    game: GameJson,
    resolvedProducts: Array<Product | null>,
    options: ValidateOptions = {},
  ): { errors: ValidationIssue[]; warnings: ValidationIssue[] } {
    const errors: ValidationIssue[] = [];
    const warnings: ValidationIssue[] = [];
    const assetExists = options.assetExists ?? (() => true);
    const mechanic: Mechanic = game.metadata.mechanic;

    const products: Product[] = [];
    resolvedProducts.forEach((product, i) => {
      const productId = game.entities[i]?.productId ?? `#${i}`;
      if (!product) {
        // AD-4: a price that does not come from the ProductProvider is a hard
        // fail — we never trust an LLM-authored price.
        errors.push(
          issue(
            'E_PRICE_SOURCE_INVALID',
            `entities.${i}.productId`,
            `product '${productId}' not found in ProductProvider`,
          ),
        );
        return;
      }
      products.push(product);
      if (!(typeof product.price === 'number' && product.price > 0)) {
        errors.push(
          issue(
            'E_PRICE_SOURCE_INVALID',
            `product.${product.productId}.price`,
            'price must be a positive number from ProductProvider',
          ),
        );
      }
      if (!assetExists(product)) {
        errors.push(
          issue(
            'E_ASSET_MISSING',
            `product.${product.productId}.image`,
            `image '${product.image}' does not exist`,
          ),
        );
      }
      if (!product.affiliate_link) {
        warnings.push(
          issue(
            'W_AFFILIATE_MISSING',
            `product.${product.productId}.affiliate_link`,
            'affiliate_link missing — warning only, render continues (AD-4)',
          ),
        );
      }
    });

    if (errors.length > 0) return { errors, warnings };

    if (mechanic === 'HI_LO') {
      if (products.length !== 2) {
        errors.push(
          issue(
            'E_GAME_LOGIC_INVALID',
            'entities',
            `HI_LO needs exactly 2 products, got ${products.length}`,
          ),
        );
      } else {
        const [a, b] = products as [Product, Product];
        if (a.price === b.price) {
          errors.push(
            issue(
              'E_HILO_EQUAL_PRICE',
              'gameplay',
              'delta 0.0% <5% — prices are equal',
            ),
          );
        } else {
          const delta = Math.abs(a.price - b.price) / Math.min(a.price, b.price);
          if (delta < HILO_MIN_DELTA) {
            errors.push(
              issue('E_HILO_EQUAL_PRICE', 'gameplay', `delta ${pct(delta)} <5%`),
            );
          }
        }
      }
    }

    if (mechanic === 'MOST_EXPENSIVE') {
      if (products.length < 3 || products.length > 4) {
        errors.push(
          issue(
            'E_GAME_LOGIC_INVALID',
            'entities',
            `MOST_EXPENSIVE needs 3-4 products, got ${products.length}`,
          ),
        );
      } else {
        const prices = products.map((p) => p.price);
        const sorted = [...prices].sort((x, y) => y - x);
        const [top, second] = sorted as [number, number];
        if (top === second) {
          errors.push(
            issue(
              'E_MOST_EXPENSIVE_TIE',
              'gameplay',
              'two products share the max price — top2 delta 0.0% <2%',
            ),
          );
        } else {
          const delta = (top - second) / second;
          if (delta < MOST_EXPENSIVE_MIN_DELTA) {
            errors.push(
              issue(
                'E_MOST_EXPENSIVE_TIE',
                'gameplay',
                `top2 delta ${pct(delta)} <2%`,
              ),
            );
          }
        }
      }
    }

    if (mechanic === 'ONE_AWAY') {
      if (products.length !== 1) {
        errors.push(
          issue(
            'E_GAME_LOGIC_INVALID',
            'entities',
            `ONE_AWAY needs exactly 1 product, got ${products.length}`,
          ),
        );
      } else {
        const hidden = game.gameplay.hidden_index;
        const priceStr = String((products[0] as Product).price);
        if (hidden === undefined || hidden === null) {
          errors.push(
            issue(
              'E_GAME_LOGIC_INVALID',
              'gameplay.hidden_index',
              'hidden_index is required for ONE_AWAY',
            ),
          );
        } else if (hidden < 0 || hidden >= priceStr.length) {
          errors.push(
            issue(
              'E_GAME_LOGIC_INVALID',
              'gameplay.hidden_index',
              `hidden_index ${hidden} out of range for price '${priceStr}' (0..${priceStr.length - 1})`,
            ),
          );
        }
      }
    }

    // Choices must never repeat a price (an ambiguous question has no answer).
    const priceCounts = new Map<number, number>();
    for (const p of products) {
      priceCounts.set(p.price, (priceCounts.get(p.price) ?? 0) + 1);
    }
    if (products.length > 1 && priceCounts.size !== products.length) {
      errors.push(
        issue(
          'E_GAME_LOGIC_INVALID',
          'choices',
          'two choices share the same price — answer would be ambiguous',
        ),
      );
    }

    return { errors, warnings };
  }

  /** Run both layers. Layer 2 is skipped when Layer 1 already failed. */
  static validate(
    game: GameJson,
    resolvedProducts: Array<Product | null>,
    options: ValidateOptions = {},
  ): ValidationResult {
    const start = performance.now();
    const errors = Validator.validateSchema(game);
    let warnings: ValidationIssue[] = [];
    if (errors.length === 0) {
      const logic = Validator.validateGameLogic(game, resolvedProducts, options);
      errors.push(...logic.errors);
      warnings = logic.warnings;
    }
    return {
      ok: errors.length === 0,
      errors,
      warnings,
      durationMs: performance.now() - start,
    };
  }
}

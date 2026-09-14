import type {
  GameJson,
  ValidationError,
  HiLoGameplay,
  MostExpensiveGameplay,
  OneAwayGameplay,
} from "@/types/game";
import { getProductById } from "./products-data";

const REQUIRED_SCENES = new Set([
  "hook",
  "product",
  "question",
  "countdown",
  "reveal",
  "result",
  "cta",
]);

const VALID_MECHANICS = new Set(["HI_LO", "MOST_EXPENSIVE", "ONE_AWAY"]);
const VALID_RESULT_VARIANTS = new Set(["in_video", "comment"]);

// ── Layer 1: Schema Validation ───────────────────────────────────────────────

export function validateSchema(game: Partial<GameJson>): ValidationError[] {
  const errors: ValidationError[] = [];

  if (!game.metadata?.gameId) {
    errors.push({
      code: "E_SCHEMA_MISSING_FIELD",
      field: "metadata.gameId",
      hint: "gameId is required",
    });
  }

  if (!game.metadata?.mechanic || !VALID_MECHANICS.has(game.metadata.mechanic)) {
    errors.push({
      code: "E_SCHEMA_MISSING_FIELD",
      field: "metadata.mechanic",
      hint: "mechanic must be HI_LO | MOST_EXPENSIVE | ONE_AWAY",
    });
  }

  if (typeof game.metadata?.seed !== "number") {
    errors.push({
      code: "E_SCHEMA_MISSING_FIELD",
      field: "metadata.seed",
      hint: "seed must be an integer",
    });
  }

  if (
    !game.metadata?.resultVariant ||
    !VALID_RESULT_VARIANTS.has(game.metadata.resultVariant)
  ) {
    errors.push({
      code: "E_SCHEMA_MISSING_FIELD",
      field: "metadata.resultVariant",
      hint: "resultVariant must be in_video | comment",
    });
  }

  if (!game.entities || !Array.isArray(game.entities) || game.entities.length === 0) {
    errors.push({
      code: "E_SCHEMA_MISSING_FIELD",
      field: "entities",
      hint: "entities[] is required and must be non-empty",
    });
  }

  if (!game.gameplay) {
    errors.push({
      code: "E_SCHEMA_MISSING_FIELD",
      field: "gameplay.answer",
      hint: "gameplay with answer is required",
    });
  }

  if (!game.scenes || !Array.isArray(game.scenes) || game.scenes.length === 0) {
    errors.push({
      code: "E_SCHEMA_MISSING_FIELD",
      field: "scenes",
      hint: "scenes[] is required",
    });
  } else {
    const sceneTypes = game.scenes.map((s) => s.type);

    // All scene types must be in 7 MVP set
    for (const t of sceneTypes) {
      if (!REQUIRED_SCENES.has(t)) {
        errors.push({
          code: "E_SCHEMA_SCENE_INVALID",
          field: "scenes",
          hint: `Invalid scene type: ${t}. Must be one of ${Array.from(REQUIRED_SCENES).join(", ")}`,
        });
      }
    }

    // Required scenes: countdown and reveal must exist
    if (!sceneTypes.includes("countdown")) {
      errors.push({
        code: "E_MISSING_REQUIRED_SCENE",
        field: "scenes",
        hint: "countdown scene is required",
      });
    }
    if (!sceneTypes.includes("reveal")) {
      errors.push({
        code: "E_MISSING_REQUIRED_SCENE",
        field: "scenes",
        hint: "reveal scene is required",
      });
    }

    // Duration total: 15-21s ±0.5s
    const totalDuration = game.scenes.reduce((sum, s) => sum + (s.duration || 0), 0);
    if (totalDuration < 14.5 || totalDuration > 21.5) {
      errors.push({
        code: "E_SCHEMA_SCENE_INVALID",
        field: "scenes",
        hint: `Total duration ${totalDuration.toFixed(1)}s must be 15-21s`,
      });
    }

    // Countdown duration must be ≥3s, ≤3.5s
    const countdownScene = game.scenes.find((s) => s.type === "countdown");
    if (countdownScene && (countdownScene.duration < 3.0 || countdownScene.duration > 3.5)) {
      errors.push({
        code: "E_TIMELINE_DRIFT",
        field: "scenes.countdown.duration",
        hint: `Countdown duration ${countdownScene.duration}s must be 3.0-3.5s`,
      });
    }
  }

  return errors;
}

// ── Layer 2: Game Logic Validation ────────────────────────────────────────────

export function validateGameLogic(game: Partial<GameJson>): ValidationError[] {
  if (!game.metadata || !game.entities || !game.gameplay) {
    return []; // Already caught by schema validation
  }

  const errors: ValidationError[] = [];
  const mechanic = game.metadata.mechanic;

  // Check price source validity — all entity prices must match ProductProvider
  for (const entity of game.entities) {
    const dbProduct = getProductById(entity.productId);
    if (!dbProduct) {
      errors.push({
        code: "E_PRICE_SOURCE_INVALID",
        field: `entities[${entity.productId}]`,
        hint: `Product ${entity.productId} not found in ProductProvider`,
      });
      continue;
    }
    if (entity.price !== dbProduct.price) {
      errors.push({
        code: "E_PRICE_SOURCE_INVALID",
        field: `entities[${entity.productId}].price`,
        hint: `Price mismatch: entity=${entity.price}, DB=${dbProduct.price}`,
      });
    }
  }

  // Mechanic-specific validation
  if (mechanic === "HI_LO") {
    const gp = game.gameplay as HiLoGameplay;
    if (!gp.priceA || !gp.priceB) {
      errors.push({
        code: "E_GAME_LOGIC_INVALID",
        field: "gameplay.priceA/priceB",
        hint: "HI_LO requires priceA and priceB",
      });
    } else {
      const delta = Math.abs(gp.priceB - gp.priceA) / gp.priceA;
      if (delta < 0.05) {
        errors.push({
          code: "E_HILO_EQUAL_PRICE",
          field: "gameplay.priceA/priceB",
          hint: `Price delta ${(delta * 100).toFixed(1)}% < 5% minimum required`,
        });
      }
      // Validate answer
      const expectedAnswer = gp.priceB > gp.priceA ? "higher" : "lower";
      if (gp.answer !== expectedAnswer) {
        errors.push({
          code: "E_GAME_LOGIC_INVALID",
          field: "gameplay.answer",
          hint: `HI_LO answer should be "${expectedAnswer}" for priceA=${gp.priceA}, priceB=${gp.priceB}`,
        });
      }
    }
    if (!["higher", "lower"].includes(gp.answer)) {
      errors.push({
        code: "E_GAME_LOGIC_INVALID",
        field: "gameplay.answer",
        hint: "HI_LO answer must be 'higher' or 'lower'",
      });
    }
  }

  if (mechanic === "MOST_EXPENSIVE") {
    const gp = game.gameplay as MostExpensiveGameplay;
    if (!gp.productIds || gp.productIds.length < 3 || gp.productIds.length > 4) {
      errors.push({
        code: "E_GAME_LOGIC_INVALID",
        field: "gameplay.productIds",
        hint: "MOST_EXPENSIVE requires 3-4 productIds",
      });
    } else {
      const prices = gp.productIds
        .map((id) => game.entities?.find((e) => e.productId === id)?.price ?? 0)
        .sort((a, b) => b - a);
      const top2Delta = (prices[0] - prices[1]) / prices[0];
      if (top2Delta < 0.02) {
        errors.push({
          code: "E_MOST_EXPENSIVE_TIE",
          field: "gameplay.productIds",
          hint: `Top 2 prices too close: delta ${(top2Delta * 100).toFixed(1)}% < 2% minimum`,
        });
      }
    }
  }

  if (mechanic === "ONE_AWAY") {
    const gp = game.gameplay as OneAwayGameplay;
    if (!gp.productId || gp.price === undefined || gp.hiddenIndex === undefined) {
      errors.push({
        code: "E_GAME_LOGIC_INVALID",
        field: "gameplay",
        hint: "ONE_AWAY requires productId, price, hiddenIndex, correctDigit, options",
      });
    } else {
      const priceStr = String(gp.price).replace(/\D/g, "");
      const expectedDigit = parseInt(priceStr[gp.hiddenIndex], 10);
      if (gp.correctDigit !== expectedDigit) {
        errors.push({
          code: "E_GAME_LOGIC_INVALID",
          field: "gameplay.correctDigit",
          hint: `correctDigit ${gp.correctDigit} != price[${gp.hiddenIndex}]=${expectedDigit}`,
        });
      }
      if (!gp.options || gp.options.length !== 2 || !gp.options.includes(gp.correctDigit)) {
        errors.push({
          code: "E_GAME_LOGIC_INVALID",
          field: "gameplay.options",
          hint: "options must be [correct_digit, wrong_digit]",
        });
      }
    }
  }

  return errors;
}

// ── Combined Validator ────────────────────────────────────────────────────────

export function validateGame(game: Partial<GameJson>): {
  valid: boolean;
  errors: ValidationError[];
} {
  const schemaErrors = validateSchema(game);
  if (schemaErrors.length > 0) {
    return { valid: false, errors: schemaErrors };
  }
  const logicErrors = validateGameLogic(game);
  return {
    valid: logicErrors.length === 0,
    errors: logicErrors,
  };
}

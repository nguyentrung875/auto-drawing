import {
  pgTable,
  text,
  integer,
  boolean,
  timestamp,
  jsonb,
  varchar,
  pgEnum,
} from "drizzle-orm/pg-core";

// ── Enums ──────────────────────────────────────────────────────────────────

export const mechanicEnum = pgEnum("mechanic", [
  "HI_LO",
  "MOST_EXPENSIVE",
  "ONE_AWAY",
]);

export const jobStatusEnum = pgEnum("job_status", [
  "pending",
  "running",
  "done",
  "failed",
]);

export const resultVariantEnum = pgEnum("result_variant", [
  "in_video",
  "comment",
]);

// ── Products table ─────────────────────────────────────────────────────────

export const products = pgTable("products", {
  productId: varchar("product_id", { length: 10 }).primaryKey(), // p001..p050
  name: text("name").notNull(),
  image: text("image").notNull(), // assets/pXXX.webp
  price: integer("price").notNull(), // VND int
  currency: varchar("currency", { length: 3 }).notNull().default("VND"),
  source: varchar("source", { length: 20 }).notNull().default("mock"),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  category: varchar("category", { length: 100 }).notNull(),
  brand: varchar("brand", { length: 100 }).notNull(),
  affiliateLink: text("affiliate_link").notNull(),
});

// ── Games table ─────────────────────────────────────────────────────────────

export const games = pgTable("games", {
  gameId: varchar("game_id", { length: 30 }).primaryKey(),
  mechanic: mechanicEnum("mechanic").notNull(),
  seed: integer("seed").notNull(),
  resultVariant: resultVariantEnum("result_variant").notNull().default("in_video"),
  status: varchar("status", { length: 20 }).notNull().default("created"),
  gameJson: jsonb("game_json"),
  outputPath: text("output_path"),
  captionJson: jsonb("caption_json"),
  validatorErrors: jsonb("validator_errors"),
  renderMs: integer("render_ms"),
  planningMs: integer("planning_ms"),
  ttsMs: integer("tts_ms"),
  encodeMs: integer("encode_ms"),
  fileSize: integer("file_size"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// ── Jobs table ──────────────────────────────────────────────────────────────

export const jobs = pgTable("jobs", {
  jobId: varchar("job_id", { length: 30 }).primaryKey(),
  gameId: varchar("game_id", { length: 30 })
    .notNull()
    .references(() => games.gameId),
  mechanic: mechanicEnum("mechanic").notNull(),
  productIds: jsonb("product_ids").notNull(), // string[]
  seed: integer("seed").notNull(),
  resultVariant: resultVariantEnum("result_variant").notNull().default("in_video"),
  status: jobStatusEnum("status").notNull().default("pending"),
  retries: integer("retries").notNull().default(0),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// ── Batches table ────────────────────────────────────────────────────────────

export const batches = pgTable("batches", {
  batchId: varchar("batch_id", { length: 30 }).primaryKey(),
  total: integer("total").notNull().default(0),
  passed: integer("passed").notNull().default(0),
  failed: integer("failed").notNull().default(0),
  avgRenderMs: integer("avg_render_ms"),
  status: varchar("status", { length: 20 }).notNull().default("running"),
  reportJson: jsonb("report_json"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// ── BatchJobs join table ─────────────────────────────────────────────────────

export const batchJobs = pgTable("batch_jobs", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  batchId: varchar("batch_id", { length: 30 })
    .notNull()
    .references(() => batches.batchId),
  jobId: varchar("job_id", { length: 30 })
    .notNull()
    .references(() => jobs.jobId),
});

// ── Logs table ───────────────────────────────────────────────────────────────

export const logs = pgTable("logs", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  gameId: varchar("game_id", { length: 30 }).notNull(),
  jobId: varchar("job_id", { length: 30 }),
  level: varchar("level", { length: 10 }).notNull().default("info"), // info|warn|error
  code: varchar("code", { length: 50 }),
  message: text("message").notNull(),
  meta: jsonb("meta"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

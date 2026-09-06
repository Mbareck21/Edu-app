import { Schema, model, models, type InferSchemaType, type Model } from "mongoose";

/**
 * One row per times-table fact, keyed "7x8" (smaller factor first, so 8×7
 * is the same row). Only the server writes these, from what he actually
 * answered. Rules live in lib/tables.ts, which is pure.
 */
const TimesFactSchema = new Schema(
  {
    key: { type: String, required: true, unique: true, trim: true },
    streak: { type: Number, default: 0 },
    correct: { type: Number, default: 0 },
    wrong: { type: Number, default: 0 },
    fast: { type: Number, default: 0 },
    lastFast: { type: Boolean, default: false },
    dueAt: { type: Date, default: null },
    lastAt: { type: Date, default: null },
  },
  { timestamps: true }
);

export type TimesFactDoc = InferSchemaType<typeof TimesFactSchema> & { _id: unknown };

export const TimesFact: Model<TimesFactDoc> =
  (models.TimesFact as Model<TimesFactDoc>) ||
  model<TimesFactDoc>("TimesFact", TimesFactSchema);

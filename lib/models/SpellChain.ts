import { Schema, model, models, type InferSchemaType, type Model } from "mongoose";

/**
 * One "write it ten times" record per word, for the whole app.
 *
 * Keyed by the word itself and NOT stored on a WordList entry, because the
 * same word can sit on a school list and in the Stuck pool at once. Two
 * counters for one word is how he writes "fifty" nine times and is told he is
 * back at zero.
 *
 * The numbers here are only ever written by the server, from what he actually
 * typed. See lib/spell-chain.ts, which owns the rules and is pure.
 */
const SpellChainSchema = new Schema(
  {
    /** Lowercase, trimmed. The identity — one row per word, app-wide. */
    word: { type: String, required: true, unique: true, trim: true, lowercase: true },
    /** Consecutive correct writes. Zeroes on any miss. */
    current: { type: Number, default: 0 },
    /** Best run he has ever reached. Only rises. */
    best: { type: Number, default: 0 },
    /** Lifetime correct writes. Only rises. Chooses how much help he gets. */
    reps: { type: Number, default: 0 },
    /** Lifetime submissions, right or wrong. */
    attempts: { type: Number, default: 0 },
    lastAt: { type: Date, default: null },
    /** Stamped the first time the chain reached ten. Never restamped. */
    graduatedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

export type SpellChainDoc = InferSchemaType<typeof SpellChainSchema> & { _id: unknown };

export const SpellChain: Model<SpellChainDoc> =
  (models.SpellChain as Model<SpellChainDoc>) ||
  model<SpellChainDoc>("SpellChain", SpellChainSchema);

import { Schema, model, models, type InferSchemaType, type Model } from "mongoose";

const WordSchema = new Schema(
  {
    word: { type: String, required: true, trim: true, lowercase: true },
    clue: { type: String, trim: true, default: "" },
  },
  { _id: false }
);

const WordListSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    hiddenMessage: { type: String, trim: true, default: "" },
    words: { type: [WordSchema], default: [] },
  },
  { timestamps: true }
);

export type WordListDoc = InferSchemaType<typeof WordListSchema> & { _id: unknown };

export const WordList: Model<WordListDoc> =
  (models.WordList as Model<WordListDoc>) ||
  model<WordListDoc>("WordList", WordListSchema);

export type ClientWord = { word: string; clue: string };
export type ClientWordList = {
  _id: string;
  name: string;
  hiddenMessage: string;
  words: ClientWord[];
  createdAt: string;
  updatedAt: string;
};

export function toClient(doc: {
  _id: unknown;
  name: string;
  hiddenMessage?: string;
  words: { word: string; clue?: string }[];
  createdAt: Date;
  updatedAt: Date;
}): ClientWordList {
  return {
    _id: String(doc._id),
    name: doc.name,
    hiddenMessage: doc.hiddenMessage || "",
    words: doc.words.map((w) => ({ word: w.word, clue: w.clue || "" })),
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}
